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
        $manager = new ImageManager(new Driver()); // Cria o gerenciador

        $base64 = $request->input('imagem');
        $colunas = $request->input('colunas', 2);
        $linhas = $request->input('linhas', 2);
        $orientacao = $request->input('orientacao', 'retrato');

        $imageData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $base64));
        $img = $manager->read($imageData);

        $larguraParte = intval($img->width() / $colunas);
        $alturaParte = intval($img->height() / $linhas);

        $partes = [];

        for ($y = 0; $y < $linhas; $y++) {
            for ($x = 0; $x < $colunas; $x++) {
                // Cria uma nova instância para cada recorte
                $recorte = $manager->read($imageData)
                    ->crop($larguraParte, $alturaParte, $x * $larguraParte, $y * $alturaParte);

                $larguraFolha = $orientacao === 'retrato' ? 2480 : 3508;
                $alturaFolha = $orientacao === 'retrato' ? 3508 : 2480;

                // $recorte->resize($larguraFolha, $alturaFolha);

                $recorte->resize($larguraFolha, null, function ($constraint) {
                    $constraint->aspectRatio();
                    $constraint->upsize(); // Mantém a proporção
                });

                $partes[] = 'data:image/jpeg;base64,' . base64_encode($recorte->toPng());
            }
        }


        return response()->json(['partes' => $partes]);
    }
}
