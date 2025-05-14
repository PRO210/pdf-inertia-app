<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

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
            $pdf->storeAs('public/pdfs', $pdf->getClientOriginalName());

            return response()->json(['success' => true]);
        }

        return response()->json(['error' => 'Nenhum arquivo enviado.'], 400);
    }
}
