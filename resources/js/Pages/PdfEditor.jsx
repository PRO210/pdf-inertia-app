import { useEffect, useRef, useState } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'
import { usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout'
import { Head } from '@inertiajs/react'

import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js'

export default function PdfEditor() {
  const { props } = usePage()
  const user = props.auth.user

  const [pdfUrl, setPdfUrl] = useState(null)
  const [imagemBase64, setImagemBase64] = useState(null)
  const [ampliacao, setAmpliacao] = useState({ colunas: 2, linhas: 2 })
  const [partesRecortadas, setPartesRecortadas] = useState([])
  const [orientacao, setOrientacao] = useState('retrato')
  const [alteracoesPendentes, setAlteracoesPendentes] = useState(false)
  const [erroPdf, setErroPdf] = useState(null)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(0)
  const [zoom, setZoom] = useState(1)

  const pdfContainerRef = useRef(null)

  const resetarConfiguracoes = () => {
    setPdfUrl(null)
    setImagemBase64(null)
    setAmpliacao({ colunas: 2, linhas: 2 })
    setPartesRecortadas([])
    setOrientacao('retrato')
    setAlteracoesPendentes(false)
    setErroPdf(null)
    setPaginaAtual(1)
    setTotalPaginas(0)
    setZoom(1)
  }

  useEffect(() => {
    if (imagemBase64) {
      recortarImagem(imagemBase64).then(setPartesRecortadas)
      setAlteracoesPendentes(true)
    }
  }, [ampliacao, orientacao, imagemBase64])

  const recortarImagem = async (base64) => {
    return new Promise((resolve) => {
      const img = new window.Image()
      img.src = base64
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const partes = []
        const larguraParte = img.width / ampliacao.colunas
        const alturaParte = img.height / ampliacao.linhas
        for (let y = 0; y < ampliacao.linhas; y++) {
          for (let x = 0; x < ampliacao.colunas; x++) {
            canvas.width = larguraParte
            canvas.height = alturaParte
            ctx.drawImage(
              img,
              x * larguraParte,
              y * alturaParte,
              larguraParte,
              alturaParte,
              0,
              0,
              larguraParte,
              alturaParte
            )
            partes.push(canvas.toDataURL())
          }
        }
        resolve(partes)
      }
    })
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result
      const partes = await recortarImagem(base64)
      setPartesRecortadas(partes)
      setImagemBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!pdfUrl) return
    setErroPdf(null)

    const renderPDF = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl)
        const pdf = await loadingTask.promise
        setTotalPaginas(pdf.numPages)

        const container = pdfContainerRef.current
        if (!container) return
        container.innerHTML = ''

        const page = await pdf.getPage(paginaAtual)
        const unscaledViewport = page.getViewport({ scale: 1 })

        // Usamos o zoom para o scale
        const scale = zoom
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.classList.add('mb-4', 'shadow-md', 'border', 'rounded')

        // Define tamanho canvas conforme viewport
        canvas.width = viewport.width
        canvas.height = viewport.height

        // CSS para limitar altura e manter proporção
        canvas.style.maxHeight = '600px'
        canvas.style.width = 'auto'
        canvas.style.height = 'auto'

        const context = canvas.getContext('2d')
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }
        await page.render(renderContext).promise
        container.appendChild(canvas)
      } catch (error) {
        setErroPdf('Erro ao renderizar o PDF. Verifique se o arquivo pdf.worker.min.js está disponível.')
        console.error("Erro ao renderizar PDF com PDF.js:", error)
      }
    }
    renderPDF()
  }, [pdfUrl, paginaAtual, zoom])

  const gerarPDF = async () => {

    const pdfDoc = await PDFDocument.create()
    const a4Retrato = [595.28, 841.89]
    const a4Paisagem = [841.89, 595.28]
    const [pageWidth, pageHeight] = orientacao === 'retrato' ? a4Retrato : a4Paisagem

    const CM_TO_POINTS = 28.3465
    const margem = 1 * CM_TO_POINTS // 1 cm em pontos

    let pageIndex = 0; // Adiciona um índice para a página atual, começando de 0

    for (const parte of partesRecortadas) {
      const page = pdfDoc.addPage([pageWidth, pageHeight])
      const imageBytes = await fetch(parte).then(res => res.arrayBuffer())
      const image = parte.includes('png')
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes)

      const escala = Math.min(
        (pageWidth - margem * 2) / image.width,
        (pageHeight - margem * 2) / image.height
      )

      const largura = image.width * escala
      const altura = image.height * escala

      // const x = margem
      // const y = pageHeight - altura - margem

      const x = margem; // A imagem sempre começa da margem esquerda

      // === INÍCIO DA NOVA LÓGICA DE POSICIONAMENTO Y ===

      // Determina a "linha" atual da imagem original que esta parte representa (0-based)
      const linhaDaImagemOriginal = Math.floor(pageIndex / ampliacao.colunas);

      let y;
      // Se for a primeira linha da imagem original (linha 0)
      if (linhaDaImagemOriginal === 0) {
        y = margem; // Alinha a parte inferior da imagem com a margem inferior da página
      }
      // Se for a última linha da imagem original
      else if (linhaDaImagemOriginal === ampliacao.linhas - 1) {
        y = pageHeight - altura - margem; // Alinha a parte superior da imagem com a margem superior da página
      }
      // Se for qualquer linha intermediária (não a primeira nem a última)
      else {
        y = pageHeight - altura - margem; // Alinha a parte superior da imagem com a margem superior da página
      }

      page.drawImage(image, { x, y, width: largura, height: altura })

      // Número da página
      page.drawText(`${pdfDoc.getPageCount()}`, {
        x: pageWidth - margem,
        y: margem - 10,
        size: 8,
        color: rgb(0, 0, 0),
      })

      pageIndex++; // Não esqueça de incrementar o índice da página

      // Pontilhado nas bordas
      const desenharLinhaPontilhada = (x1, y1, x2, y2, segmento = 5, espaco = 3) => {
        const dx = x2 - x1
        const dy = y2 - y1
        const comprimento = Math.sqrt(dx * dx + dy * dy)
        const passos = Math.floor(comprimento / (segmento + espaco))
        const incX = dx / comprimento
        const incY = dy / comprimento
        for (let i = 0; i < passos; i++) {
          const inicioX = x1 + (segmento + espaco) * i * incX
          const inicioY = y1 + (segmento + espaco) * i * incY
          const fimX = inicioX + segmento * incX
          const fimY = inicioY + segmento * incY
          page.drawLine({
            start: { x: inicioX, y: inicioY },
            end: { x: fimX, y: fimY },
            thickness: 0.5,
            color: rgb(0, 0, 0),
          })
        }
      }
      desenharLinhaPontilhada(margem, margem, pageWidth - margem, margem)
      desenharLinhaPontilhada(margem, pageHeight - margem, pageWidth - margem, pageHeight - margem)
      desenharLinhaPontilhada(margem, margem, margem, pageHeight - margem)
      desenharLinhaPontilhada(pageWidth - margem, margem, pageWidth - margem, pageHeight - margem)
    }

    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    setPdfUrl(URL.createObjectURL(blob))
    setPaginaAtual(1)
  }

  const downloadPDF = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = 'documento.pdf'
    a.click()
  }

  return (
    <AuthenticatedLayout>
      <Head title="Editor" />
      <div className="p-4">
        <div className="flex flex-col md:flex-row gap-2">

          {/* Opções */}
          <div className="flex flex-col items-center justify-center gap-4 w-full md:w-1/5" id="opcoes">
            <div className="w-full text-center md:text-2xl">
              <h1>Opções</h1>
            </div>

            <div className="w-full">
              <label className="block mb-1 pro-label text-center text-xl">Orientação:</label>
              <select
                className="px-2 w-full rounded-full pro-input"
                name="orientacao"
                id="orientacao"
                value={orientacao}
                onChange={(e) => setOrientacao(e.target.value)}
              >
                <option value="retrato">Retrato</option>
                <option value="paisagem">Paisagem</option>
              </select>
            </div>
            <br />

            <div className="w-full flex flex-col items-center">
              <label className="block mb-2 pro-label text-xl text-center">Ampliação:</label>
              <div className="flex gap-2 items-center">
                <div>
                  <label className="block text-sm text-center">Colunas</label>
                  <input
                    type="number"
                    min="1"
                    className="pro-input px-2 py-1 rounded-md w-20 text-center"
                    value={ampliacao.colunas}
                    onChange={(e) =>
                      setAmpliacao((prev) => ({ ...prev, colunas: parseInt(e.target.value) || 1 }))
                    }
                  />
                </div>
                <span className="text-xl">×</span>
                <div>
                  <label className="block text-sm text-center">Linhas</label>
                  <input
                    type="number"
                    min="1"
                    className="pro-input px-2 py-1 rounded-md w-20 text-center"
                    value={ampliacao.linhas}
                    onChange={(e) =>
                      setAmpliacao((prev) => ({ ...prev, linhas: parseInt(e.target.value) || 1 }))
                    }
                  />
                </div>
              </div>
            </div>
            <br />

            <div className="flex flex-col gap-2 w-full">
              {user && (
                <>
                  <button
                    onClick={() => {
                      gerarPDF()
                      setAlteracoesPendentes(false)
                    }}
                    className={alteracoesPendentes ? "pro-btn-red" : "pro-btn-purple"}
                  >
                    {alteracoesPendentes ? "Aplicar alterações" : "Gerar PDF"}
                  </button>

                  <button onClick={downloadPDF} className="pro-btn-green mt-2" disabled={!pdfUrl}>
                    Baixar PDF
                  </button>

                  <div className="flex justify-center gap-2 mt-2">
                    <button
                      onClick={() => setZoom((z) => Math.max(z - 0.1, 0.25))}
                      disabled={zoom <= 0.25}
                      className="pro-btn-blue px-3 py-1 rounded"
                    >
                      -
                    </button>
                    <span className="flex items-center px-2">{(zoom * 100).toFixed(0)}%</span>
                    <button
                      onClick={() => setZoom((z) => Math.min(z + 0.1, 3))}
                      disabled={zoom >= 3}
                      className="pro-btn-blue px-3 py-1 rounded"
                    >
                      +
                    </button>
                  </div>
                </>
              )}
            </div>

            <br />

            <div className='w-full'>
              <button onClick={resetarConfiguracoes} className="pro-btn-slate">
                Resetar Configurações
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="md:w-4/5 my-4" id="preview">
            <div className="mx-auto mb-4 p-4 rounded-2xl ">
              <h1 className="sm:text-xl md:text-2xl text-center font-bold whitespace-nowrap">
                Preview do{" "}
                <span>
                  {pdfUrl ? "Banner em PDF" : "da Imagem"}
                </span>
              </h1>
              {/* Paginação */}
              {pdfUrl && totalPaginas > 1 && (
                <div className="mt-4 flex justify-center items-center gap-4">
                  <button
                    onClick={() => setPaginaAtual((p) => Math.max(p - 1, 1))}
                    disabled={paginaAtual === 1}
                    className={`pro-btn-blue ${paginaAtual === 1 ? 'bg-gray-400 cursor-not-allowed' : ''}`}
                  >
                    Página anterior
                  </button>
                  <span className="text-lg whitespace-nowrap">
                    {paginaAtual} / {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPaginaAtual((p) => Math.min(p + 1, totalPaginas))}
                    disabled={paginaAtual === totalPaginas}
                    className={`pro-btn-blue ${paginaAtual === totalPaginas ? 'bg-gray-400 cursor-not-allowed' : ''}`}
                  >
                    Próxima página
                  </button>
                </div>
              )}
            </div>

            <div
              id="pdf-preview"
              className="w-full border-2 border-gray-300 rounded-lg mx-auto overflow-x-auto flex justify-center items-center p-4 bg-gray-100"
              style={{ minHeight: '600px' }}
            >
              {pdfUrl ? (
                <div
                  key={pdfUrl} // força remontagem ao trocar
                  ref={pdfContainerRef}
                  className="w-full max-w-full overflow-auto flex flex-col items-center"
                />
              ) : imagemBase64 ? (
                <img
                  src={imagemBase64}
                  alt="Pré-visualização da imagem carregada"
                  className="max-h-[500px] object-contain rounded-md shadow-md"
                />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px]">
                  <div>
                    <label className="pro-label text-center text-xl">Nenhuma Imagem Selecionada:</label>
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={handleFileChange}
                      className="pro-btn-blue
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100 cursor-pointer"
                    />
                  </div>
                </div>
              )}
              {erroPdf && (
                <div className="text-red-600 mt-2 text-center">{erroPdf}</div>
              )}
            </div>
          </div>


        </div>
      </div>
    </AuthenticatedLayout>
  )
}
