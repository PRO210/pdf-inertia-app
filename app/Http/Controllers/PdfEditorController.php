<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;

class PdfEditorController extends Controller
{
    public function index()
    {
        return Inertia::render('PdfEditor');
    }

    public function store(Request $request)
    {

        if ($request->hasFile('pdf')) {
            $pdf = $request->file('pdf');
            $filename = $pdf->getClientOriginalName();
            $pdf->storeAs('public/pdfs', $filename);

            $url = asset('storage/pdfs/' . $filename); // URL acessível no frontend

            return response()->json([
                'success' => true,
                'url' => $url
            ]);
        }

        return response()->json(['error' => 'Nenhum arquivo enviado.'], 400);
    }
   
    public function cortarImagem(Request $request)
    {
        $manager = new ImageManager(new Driver());

        $base64 = $request->input('imagem');
        $colunas = (int) $request->input('colunas', 2);
        $linhas = (int) $request->input('linhas', 2);
        $orientacao = $request->input('orientacao', 'retrato');

        // Decodifica e lê a imagem original apenas uma vez
        $imageData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $base64));
        $imgOriginal = $manager->read($imageData);

       
        $larguraImagem = $imgOriginal->width();
        $alturaImagem = $imgOriginal->height();

        $larguraParte = intval($larguraImagem / $colunas);
        $alturaParte = intval($alturaImagem / $linhas);

        // Dimensões da folha A4 em pixels 300 DPI (retrato ou paisagem)
        $larguraFolha = $orientacao === 'retrato' ? 2480 : 3508;
        $alturaFolha = $orientacao === 'retrato' ? 3508 : 2480;

        // Cada parte deve ocupar essa fração da folha
        $larguraAlvo = intval($larguraFolha / $colunas);
        $alturaAlvo = intval($alturaFolha / $linhas);

        $partes = [];

        for ($y = 0; $y < $linhas; $y++) {
            for ($x = 0; $x < $colunas; $x++) {
                // Clona a imagem original para evitar reler o base64
                $recorte = clone $imgOriginal;
                $recorte->crop($larguraParte, $alturaParte, $x * $larguraParte, $y * $alturaParte);

                // Redimensiona para caber na fração da folha, mantendo proporção
                $recorte->resize($larguraAlvo, $alturaAlvo, function ($constraint) {
                    $constraint->aspectRatio();
                    $constraint->upsize();
                });

                // Cria um canvas branco com o tamanho da fração da folha e centraliza o recorte
                $canvas = $manager->create($larguraAlvo, $alturaAlvo)->fill('ffffff');
                $canvas->place($recorte, 'center');

                // Converte para PNG com qualidade máxima
                $partes[] = 'data:image/png;base64,' . base64_encode($canvas->toPng());
            }
        }

        return response()->json(['partes' => $partes]);
    }
}
