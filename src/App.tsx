/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sprout, 
  Map as MapIcon, 
  MapPin,
  ClipboardCheck, 
  ShieldCheck, 
  Leaf, 
  Loader2, 
  Sun, 
  CloudRain, 
  Wind,
  Trash2,
  Plus,
  X,
  Maximize2,
  Download
} from "lucide-react";
import ReactMarkdown from 'react-markdown';

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const PLANT_GROUPS = {
  "Solanáceas": ["Tomate", "Pimiento", "Berenjena", "Patata", "Physalis", "Chile"],
  "Cucurbitáceas": ["Calabacín", "Pepino", "Calabaza", "Melón", "Sandía"],
  "Leguminosas": ["Judía", "Guisante", "Haba", "Garbanzo", "Lenteja"],
  "Crucíferas": ["Brócoli", "Coliflor", "Repollo", "Rábano", "Rúcula", "Kale"],
  "Liliáceas/Umbelíferas": ["Cebolla", "Ajo", "Puerro", "Zanahoria", "Apio", "Perejil", "Chirivía"],
  "Hojas/Otras": ["Lechuga", "Espinaca", "Acelga", "Canónigos", "Escarola", "Remolacha", "Maíz", "Fresa"],
  "Aromáticas": ["Albahaca", "Romero", "Menta", "Tomillo", "Lavanda", "Orégano", "Cilantro"]
};

const COMMON_PLANTS = Object.values(PLANT_GROUPS).flat();

// Helper for exponential backoff retries
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED";
      if (isRateLimit && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

type SpaceType = 'balcon' | 'patio' | 'campo';
type ClimateType = 'tropical' | 'templado' | 'arido' | 'frio';
type ViewMode = 'both' | 'perspective' | 'layout' | 'none';
type MethodType = 'standard' | 'gaspar';

export default function App() {
  const [plants, setPlants] = useState<string[]>([]);
  const [currentPlant, setCurrentPlant] = useState("");
  const [space, setSpace] = useState<SpaceType>('patio');
  const [climate, setClimate] = useState<ClimateType>('templado');
  const [location, setLocation] = useState("");
  const [width, setWidth] = useState<string>("5");
  const [length, setLength] = useState<string>("2");
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [method, setMethod] = useState<MethodType>('standard');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sources, setSources] = useState<{ title: string; uri: string }[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [layoutImage, setLayoutImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [harvestedPlants, setHarvestedPlants] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [isSketching, setIsSketching] = useState(false);

  const downloadAsHtml = () => {
    if (!result) return;
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mi Huerta Regenerativa - Permacultura Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
    <style>
        body { background-color: #fdfcf8; padding: 2rem; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 3rem; border-radius: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
        .header { text-align: center; margin-bottom: 3rem; border-bottom: 2px solid #f0fdf4; pb: 2rem; }
        .image-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 1.5rem; margin: 2rem 0; }
        img { width: 100%; border-radius: 1rem; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .footer { margin-top: 4rem; text-align: center; font-size: 0.8rem; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #2d3a2d; font-size: 2.5rem; font-weight: bold;">Mi Huerta Regenerativa</h1>
            <p style="color: #65a30d;">Diseño generado por Permacultura Pro</p>
            <p style="font-size: 0.9rem; color: #94a3b8;">${new Date().toLocaleDateString()}</p>
        </div>

        <div class="image-grid">
            ${image ? `<div><p style="font-size: 0.7rem; font-weight: bold; text-transform: uppercase; color: #166534; margin-bottom: 0.5rem;">Perspectiva</p><img src="${image}" alt="Perspectiva"></div>` : ''}
            ${layoutImage ? `<div><p style="font-size: 0.7rem; font-weight: bold; text-transform: uppercase; color: #166534; margin-bottom: 0.5rem;">Plano</p><img src="${layoutImage}" alt="Plano"></div>` : ''}
        </div>

        <div class="markdown-body">
            ${result.replace(/\n/g, '<br>').replace(/# (.*)/g, '<h1>$1</h1>').replace(/## (.*)/g, '<h2>$1</h2>').replace(/- (.*)/g, '<li>$1</li>')}
        </div>

        <div class="footer">
            <p>Permacultura Pro - Agricultura para un futuro sostenible</p>
        </div>
    </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `huerta-permacultura-${new Date().getTime()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addPlant = () => {
    if (currentPlant.trim() && !plants.includes(currentPlant.trim())) {
      setPlants([...plants, currentPlant.trim()]);
      setCurrentPlant("");
    }
  };

  const togglePlant = (plantName: string) => {
    if (plants.includes(plantName)) {
      setPlants(plants.filter(p => p !== plantName));
    } else {
      setPlants([...plants, plantName]);
    }
  };

  const generateDesign = async () => {
    if (plants.length === 0) return;
    
    setLoading(true);
    setImageLoading(true);
    setResult(null);
    setSources([]);
    setImage(null);
    setLayoutImage(null);
    setIsSketching(false);

    const systemInstruction = `
      Experto en Permacultura. Sé ultra-conciso y estructurado.
      ${method === 'gaspar' ? 'USA EL MÉTODO GASPAR CABALLERO (Parades en Crestall).' : ''}
      FORMATO OBLIGATORIO:
      # 🌿 Fichas de Cultivo
      (Para cada planta seleccionada, crea una sección horizontal con: **Nombre**, **Consejo Rápido**, **Plan de Acción**)
      
      # 🌤️ Clima y Calendario
      - Análisis para ${location || climate}.
      - Tabla de Tiempos: | Especie | Siembra | Cosecha | Distancia |
      
      # 🛡️ Mantenimiento y Retirada
      - Tareas críticas del mes.
      ${method === 'gaspar' ? '- Explicación de la rotación de 4 grupos (Solanáceas, Umbelíferas/Liliáceas, Leguminosas/Crucíferas, Compuestas/Cucurbitáceas).' : '- Guía para la retirada/cosecha de plantas agotadas.'}
    `;

    const size = (parseFloat(width) * parseFloat(length)).toFixed(1);
    const currentDate = new Date().toLocaleDateString('es-ES', { month: 'long' });
    const prompt = `Huerta de ${width}m de ancho x ${length}m de largo (total ${size}m²) en ${space}. Clima: ${climate}. ${location ? `Ubicación: ${location}.` : ''} Plantas: ${plants.join(", ")}. Mes: ${currentDate}. ${method === 'gaspar' ? 'Diseño siguiendo estrictamente el método Gaspar Caballero (Parades en Crestall).' : 'Diseño permacultura estándar.'} Diseño ultra-conciso. Asegúrate de que las plantas mencionadas en el texto coincidan exactamente con las que se verán en el diseño visual.`;

    try {
      // Text Generation with Retry and Search Grounding (only if location is provided)
      const textResponse = await withRetry(() => 
        genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: { 
            systemInstruction: systemInstruction,
            tools: location ? [{ googleSearch: {} }] : []
          }
        })
      );
      
      setResult(textResponse.text || "No se pudo generar el diseño.");
      
      // Extract grounding sources
      const groundingChunks = textResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        const extractedSources = groundingChunks
          .map((chunk: any) => chunk.web)
          .filter((web: any) => web && web.uri && web.title)
          .map((web: any) => ({ title: web.title, uri: web.uri }));
        setSources(extractedSources);
      }
      
      setLoading(false); // Text is now visible

      if (viewMode === 'none') {
        setImageLoading(false);
        return;
      }

      setIsSketching(true); // Show placeholders for images
      
      // Small delay to ensure UI renders text before starting heavy image calls
      await new Promise(resolve => setTimeout(resolve, 500));

      // Image Generation 1: Watercolor Perspective with Retry
      const imagePrompt = method === 'gaspar' 
        ? `Huerta método Gaspar Caballero (Parades en Crestall) en ${space} (${width}m x ${length}m), clima ${climate}. Estilo acuarela. Se ven las camas de 1.5m de ancho con pasillos de baldosas centrales. Plantas visibles: ${plants.join(", ")}. Asegúrate de que las plantas sean reconocibles y correspondan a sus nombres.`
        : `Huerta permacultura en ${space} (${width}m x ${length}m), clima ${climate}. Estilo acuarela. Plantas visibles: ${plants.join(", ")}. Asegúrate de que las plantas sean reconocibles y correspondan a sus nombres.`;

      // Image Generation 2: Top-down Layout with Retry
      const layoutPrompt = method === 'gaspar'
        ? `Plano cenital técnico de huerta ${width}m x ${length}m siguiendo el método Gaspar Caballero. Camas rectangulares de 1.5m con pasillo central. Estilo diagrama limpio. Incluye etiquetas de texto claras para cada planta: ${plants.join(", ")}.`
        : `Plano cenital técnico de huerta ${width}m x ${length}m. Estilo diagrama limpio. Incluye etiquetas de texto claras para cada planta: ${plants.join(", ")}.`;

      // Run image generations based on viewMode
      const promises: Promise<any>[] = [];
      
      if (viewMode === 'both' || viewMode === 'perspective') {
        promises.push(withRetry(() => genAI.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: { parts: [{ text: imagePrompt }] }
        })));
      } else {
        promises.push(Promise.resolve(null));
      }

      if (viewMode === 'both' || viewMode === 'layout') {
        promises.push(withRetry(() => genAI.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: { parts: [{ text: layoutPrompt }] }
        })));
      } else {
        promises.push(Promise.resolve(null));
      }

      const [imageRes, layoutRes] = await Promise.allSettled(promises);

      // Process Perspective Image
      if (imageRes.status === 'fulfilled' && imageRes.value) {
        const response = imageRes.value;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            setImage(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      }

      // Process Layout Image
      if (layoutRes.status === 'fulfilled' && layoutRes.value) {
        const response = layoutRes.value;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            setLayoutImage(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      }

    } catch (error: any) {
      console.error("Error generating design:", error);
      const errorMessage = error?.message?.toLowerCase() || "";
      const isQuotaError = errorMessage.includes("429") || 
                          errorMessage.includes("quota") || 
                          error?.status === "RESOURCE_EXHAUSTED";
      
      if (isQuotaError) {
        setResult(`
⚠️ **Límite de cuota excedido.** 

El experto en permacultura ha alcanzado su límite de consultas. Esto suele ocurrir por la generación de imágenes en alta resolución.

**Sugerencia:** Prueba seleccionando la opción **"Solo Texto"** en el panel de la izquierda. Esto consume menos recursos y suele funcionar incluso cuando el límite de imágenes se ha alcanzado.
        `);
      } else if (!result) {
        setResult("Ocurrió un error al conectar con el experto en permacultura. Por favor, revisa tu conexión e intenta de nuevo.");
      }
    } finally {
      setLoading(false);
      setImageLoading(false);
      setIsSketching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcf8] text-[#2d3a2d] font-sans selection:bg-green-200">
      {/* Header */}
      <header className="bg-[#2d3a2d] text-white py-12 px-4 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10"><Leaf size={120} /></div>
          <div className="absolute bottom-10 right-10 rotate-180"><Leaf size={120} /></div>
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block p-3 bg-green-600 rounded-2xl mb-4"
          >
            <Sprout size={40} />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Permacultura Pro
          </h1>
          <p className="text-green-100 text-lg md:text-xl max-w-2xl mx-auto">
            Diseñador de Huertas Regenerativas: Transforma tu espacio en un ecosistema vivo y productivo.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12 -mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Input Panel */}
          <section className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-green-100">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <ClipboardCheck className="text-green-600" /> Configuración Inicial
              </h2>

              {/* Plants Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ¿Qué quieres plantar?
                </label>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={currentPlant}
                    onChange={(e) => setCurrentPlant(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPlant()}
                    placeholder="Ej: Tomate, Albahaca..."
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  />
                  <button
                    onClick={addPlant}
                    className="bg-green-600 text-white p-2 rounded-xl hover:bg-green-700 transition-colors"
                  >
                    <Plus size={24} />
                  </button>
                </div>

                {/* Clickable Common Plants */}
                <div className="mb-6">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Sugerencias por Grupos Botánicos</p>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-green-100">
                    {Object.entries(PLANT_GROUPS).map(([group, plants_in_group]) => (
                      <div key={group}>
                        <p className="text-[9px] font-semibold text-green-700 mb-1.5 uppercase tracking-tight">{group}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {plants_in_group.map((plant) => (
                            <button
                              key={plant}
                              onClick={() => togglePlant(plant)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] transition-all border ${
                                plants.includes(plant)
                                ? 'bg-green-600 text-white border-green-600 shadow-sm'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:text-green-600'
                              }`}
                            >
                              {plant}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <AnimatePresence>
                    {plants.map((plant) => (
                      <motion.span
                        key={plant}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="bg-green-100 text-green-800 px-3 py-1 rounded-lg text-sm flex items-center gap-2 border border-green-200"
                      >
                        {plant}
                        <button onClick={() => togglePlant(plant)} className="hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  {plants.length === 0 && (
                    <span className="text-gray-400 text-sm italic">Selecciona o escribe hortalizas...</span>
                  )}
                </div>
              </div>

              {/* Space Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Espacio
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['balcon', 'patio', 'campo'] as SpaceType[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpace(s)}
                      className={`py-2 px-3 rounded-xl text-sm font-medium capitalize transition-all border ${
                        space === s 
                        ? 'bg-green-600 text-white border-green-600 shadow-md' 
                        : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Climate */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clima Predominante
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['tropical', 'templado', 'arido', 'frio'] as ClimateType[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setClimate(c)}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium capitalize transition-all border ${
                        climate === c 
                        ? 'bg-green-600 text-white border-green-600 shadow-md' 
                        : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'
                      }`}
                    >
                      {c === 'tropical' && <CloudRain size={16} />}
                      {c === 'templado' && <Sun size={16} />}
                      {c === 'arido' && <Wind size={16} />}
                      {c === 'frio' && <Loader2 size={16} className="animate-spin-slow" />}
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-green-600" /> Ubicación (Ciudad/Región)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Madrid, España"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-sm"
                />
                <p className="mt-1 text-[10px] text-gray-400 italic">
                  * Usado para la previsión meteorológica real y calendario local.
                </p>
              </div>

              {/* Garden Dimensions */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dimensiones de la Huerta (Metros)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Ancho (m)</span>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Largo (m)</span>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none text-sm font-bold"
                    />
                  </div>
                </div>
                <div className="mt-3 bg-green-50 text-green-700 px-4 py-2 rounded-xl font-bold border border-green-100 text-center text-sm">
                  Superficie Total: {(parseFloat(width || "0") * parseFloat(length || "0")).toFixed(1)} m²
                </div>
              </div>

              {/* View Mode */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Ilustración
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['perspective', 'layout', 'both', 'none'] as ViewMode[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setViewMode(v)}
                      className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-tighter transition-all border ${
                        viewMode === v 
                        ? 'bg-green-600 text-white border-green-600 shadow-md' 
                        : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                      }`}
                    >
                      {v === 'perspective' && 'Perspectiva'}
                      {v === 'layout' && 'Plano'}
                      {v === 'both' && 'Ambos'}
                      {v === 'none' && 'Solo Texto'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Method Selection */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-green-600" /> Método de Cultivo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMethod('standard')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border ${
                      method === 'standard' 
                      ? 'bg-green-600 text-white border-green-600 shadow-md' 
                      : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    Estándar Permacultura
                  </button>
                  <button
                    onClick={() => setMethod('gaspar')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border ${
                      method === 'gaspar' 
                      ? 'bg-green-600 text-white border-green-600 shadow-md' 
                      : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    Gaspar Caballero
                  </button>
                </div>
                {method === 'gaspar' && (
                  <p className="mt-2 text-[10px] text-green-600 italic font-medium">
                    * Se aplicará el sistema de "Parades en Crestall" con rotación de 4 grupos.
                  </p>
                )}
              </div>

              <button
                onClick={generateDesign}
                disabled={loading || plants.length === 0}
                className="w-full bg-[#2d3a2d] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#1e271e] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Analizando Ecosistema...
                  </>
                ) : (
                  <>
                    <Sprout />
                    Generar Diseño Regenerativo
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Results Panel */}
          <section className="lg:col-span-7">
            <div className="bg-white min-h-[600px] rounded-3xl shadow-sm border border-green-100 p-8 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center"
                  >
                    <div className="relative mb-8">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="text-green-100"
                      >
                        <Leaf size={120} />
                      </motion.div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="animate-spin text-green-600" size={40} />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-[#2d3a2d] mb-2">Diseñando tu oasis...</h3>
                    <p className="text-gray-500 max-w-sm">
                      Estamos aplicando la regla de las 3 Emes y analizando asociaciones alelopáticas para tu huerta.
                    </p>
                  </motion.div>
                ) : result ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    {/* Design Illustrations */}
                    {viewMode !== 'none' && (
                      <div className={`grid gap-4 ${viewMode === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                        <AnimatePresence mode="wait">
                          {isSketching ? (
                            <>
                              {(viewMode === 'both' || viewMode === 'perspective') && (
                                <motion.div 
                                  key="img-sketch-1"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="w-full aspect-square bg-gray-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-green-100"
                                >
                                  <Loader2 className="animate-spin text-green-400 mb-2" size={32} />
                                  <p className="text-xs text-gray-400 font-medium italic">Pintando perspectiva...</p>
                                </motion.div>
                              )}
                              {(viewMode === 'both' || viewMode === 'layout') && (
                                <motion.div 
                                  key="img-sketch-2"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="w-full aspect-square bg-gray-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-green-100"
                                >
                                  <Loader2 className="animate-spin text-green-400 mb-2" size={32} />
                                  <p className="text-xs text-gray-400 font-medium italic">Dibujando plano...</p>
                                </motion.div>
                              )}
                            </>
                          ) : (
                            <>
                              {(viewMode === 'both' || viewMode === 'perspective') && (
                                image ? (
                                  <motion.div
                                    key="img-ready-1"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative group cursor-zoom-in"
                                    onClick={() => setSelectedImage(image)}
                                  >
                                    <img 
                                      src={image} 
                                      alt="Perspectiva acuarela" 
                                      className="w-full aspect-square object-cover rounded-2xl shadow-md border-2 border-white transition-transform duration-500 group-hover:scale-[1.02]"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                                      <div className="bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/30 text-white">
                                        <Maximize2 size={24} />
                                      </div>
                                    </div>
                                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-bold text-green-800 uppercase tracking-widest shadow-sm">
                                      Perspectiva Artística
                                    </div>
                                  </motion.div>
                                ) : imageLoading ? (
                                   <div className="w-full aspect-square bg-gray-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-green-100">
                                      <Loader2 className="animate-spin text-green-400 mb-2" size={32} />
                                      <p className="text-xs text-gray-400 font-medium italic">Finalizando...</p>
                                   </div>
                                ) : (
                                  <div className="w-full aspect-square bg-gray-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-gray-200 p-4 text-center">
                                    <CloudRain className="text-gray-300 mb-2" size={24} />
                                    <p className="text-[10px] text-gray-400 italic">No se pudo generar la perspectiva (límite de cuota)</p>
                                  </div>
                                )
                              )}
                              {(viewMode === 'both' || viewMode === 'layout') && (
                                layoutImage ? (
                                  <motion.div
                                    key="img-ready-2"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative group cursor-zoom-in"
                                    onClick={() => setSelectedImage(layoutImage)}
                                  >
                                    <img 
                                      src={layoutImage} 
                                      alt="Plano cenital" 
                                      className="w-full aspect-square object-cover rounded-2xl shadow-md border-2 border-white transition-transform duration-500 group-hover:scale-[1.02]"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                                      <div className="bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/30 text-white">
                                        <Maximize2 size={24} />
                                      </div>
                                    </div>
                                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-bold text-green-800 uppercase tracking-widest shadow-sm">
                                      Plano de Disposición (Cenital)
                                    </div>
                                  </motion.div>
                                ) : imageLoading ? (
                                  <div className="w-full aspect-square bg-gray-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-green-100">
                                     <Loader2 className="animate-spin text-green-400 mb-2" size={32} />
                                     <p className="text-xs text-gray-400 font-medium italic">Finalizando...</p>
                                  </div>
                                ) : (
                                  <div className="w-full aspect-square bg-gray-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-gray-200 p-4 text-center">
                                    <Wind className="text-gray-300 mb-2" size={24} />
                                    <p className="text-[10px] text-gray-400 italic">No se pudo generar el plano (límite de cuota)</p>
                                  </div>
                                )
                              )}
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <div className="mt-8">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-[#2d3a2d] flex items-center gap-3">
                          <MapIcon className="text-green-600" /> Tu Diseño Regenerativo
                        </h2>
                        {result && (
                          <button
                            onClick={downloadAsHtml}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all shadow-md"
                          >
                            <Download size={16} /> Descargar Informe HTML
                          </button>
                        )}
                      </div>
                      <div className="markdown-body">
                        <ReactMarkdown
                          components={{
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-6 rounded-2xl border border-green-100 shadow-sm">
                                <table className="w-full text-sm text-left border-collapse">
                                  {children}
                                </table>
                              </div>
                            ),
                            caption: ({ children }) => (
                              <caption className="text-xs text-gray-400 italic mt-2 text-center">
                                {children}
                              </caption>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-green-50 text-green-900 font-bold uppercase tracking-wider text-[10px]">
                                {children}
                              </thead>
                            ),
                            tbody: ({ children }) => (
                              <tbody className="divide-y divide-green-50">
                                {children}
                              </tbody>
                            ),
                            tfoot: ({ children }) => (
                              <tfoot className="bg-green-50/50">
                                {children}
                              </tfoot>
                            ),
                            th: ({ children }) => (
                              <th className="px-4 py-3 border-b border-green-100">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-4 py-3 border-b border-green-50 text-gray-600">
                                {children}
                              </td>
                            ),
                            tr: ({ children }) => (
                              <tr className="hover:bg-green-50/30 transition-colors">
                                {children}
                              </tr>
                            ),
                            h1: ({ children }) => {
                              const text = String(children);
                              const isFichas = text.includes('Fichas');
                              const isClima = text.includes('Clima');
                              const isMantenimiento = text.includes('Mantenimiento');
                              
                              return (
                                <h1 className={`text-2xl font-bold mt-12 mb-6 border-b-2 pb-2 flex items-center gap-3 ${
                                  isFichas ? 'text-green-700 border-green-200' : 
                                  isClima ? 'text-blue-700 border-blue-200' : 
                                  'text-[#2d3a2d] border-green-100'
                                }`}>
                                  {isFichas && <Leaf className="text-green-500" size={28} />}
                                  {isClima && <Sun className="text-blue-500" size={28} />}
                                  {isMantenimiento && <ShieldCheck className="text-orange-500" size={28} />}
                                  {children}
                                </h1>
                              );
                            },
                            h2: ({ children }) => (
                              <h2 className="text-lg font-bold text-green-800 mt-8 mb-3 bg-green-50/50 px-4 py-2 rounded-xl border-l-4 border-green-500 flex items-center gap-2">
                                <Sprout size={18} className="text-green-500" />
                                {children}
                              </h2>
                            ),
                            ul: ({ children }) => (
                              <ul className="space-y-2 my-4 list-none pl-0">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="space-y-2 my-4 list-decimal pl-6 text-gray-700">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="flex items-start gap-3 text-gray-700">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                <span>{children}</span>
                              </li>
                            ),
                            p: ({ children }) => (
                              <p className="text-gray-700 leading-relaxed my-3">
                                {children}
                              </p>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-bold text-green-800">
                                {children}
                              </strong>
                            ),
                            em: ({ children }) => (
                              <em className="italic text-green-700/80">
                                {children}
                              </em>
                            ),
                            code: ({ children }) => (
                              <code className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-mono text-xs">
                                {children}
                              </code>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-green-200 pl-4 my-4 italic text-gray-600">
                                {children}
                              </blockquote>
                            ),
                            a: ({ children, href }) => (
                              <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-800 underline underline-offset-4 decoration-green-200 hover:decoration-green-400 transition-all font-medium"
                              >
                                {children}
                              </a>
                            ),
                            img: ({ src, alt }) => (
                              <img 
                                src={src} 
                                alt={alt} 
                                className="rounded-2xl shadow-md my-6 w-full"
                                referrerPolicy="no-referrer"
                              />
                            ),
                            hr: () => (
                              <hr className="my-8 border-t-2 border-green-50" />
                            ),
                          }}
                        >
                          {result}
                        </ReactMarkdown>
                      </div>

                      {/* Interactive Removal Tracker */}
                      {plants.length > 0 && result && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-12 p-6 bg-white rounded-3xl border-2 border-green-100 shadow-sm"
                        >
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-green-100 rounded-xl text-green-600">
                              <ClipboardCheck size={24} />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-[#2d3a2d]">Calendario Interactivo de Cosecha</h3>
                              <p className="text-xs text-gray-500 italic">Marca las plantas que ya has retirado o cosechado</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {plants.map((plant) => {
                              const isHarvested = harvestedPlants.includes(plant);
                              return (
                                <button
                                  key={plant}
                                  onClick={() => {
                                    if (isHarvested) {
                                      setHarvestedPlants(harvestedPlants.filter(p => p !== plant));
                                    } else {
                                      setHarvestedPlants([...harvestedPlants, plant]);
                                    }
                                  }}
                                  className={`
                                    flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left
                                    ${isHarvested 
                                      ? 'bg-green-50 border-green-200 text-green-700 opacity-60 grayscale-[0.5]' 
                                      : 'bg-white border-gray-100 text-gray-700 hover:border-green-200 hover:bg-green-50/30'}
                                  `}
                                >
                                  <div className={`
                                    w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
                                    ${isHarvested ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 bg-white'}
                                  `}>
                                    {isHarvested && <ShieldCheck size={12} />}
                                  </div>
                                  <span className={`text-sm font-medium truncate ${isHarvested ? 'line-through' : ''}`}>
                                    {plant}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {harvestedPlants.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-green-50 flex justify-between items-center">
                              <p className="text-xs text-gray-400">
                                {harvestedPlants.length} de {plants.length} plantas gestionadas
                              </p>
                              <button 
                                onClick={() => setHarvestedPlants([])}
                                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                              >
                                Reiniciar tracker
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* Grounding Sources */}
                      {sources.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-green-100">
                          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ShieldCheck size={16} /> Fuentes y Referencias (Google Search)
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sources.map((source, idx) => (
                              <a 
                                key={idx}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50 transition-all text-xs flex flex-col gap-1"
                              >
                                <span className="font-bold text-green-800 line-clamp-1">{source.title}</span>
                                <span className="text-gray-400 truncate">{source.uri}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-gray-400"
                  >
                    <MapIcon size={80} strokeWidth={1} className="mb-6 opacity-20" />
                    <h3 className="text-xl font-medium mb-2">Tu Mapa Regenerativo</h3>
                    <p className="max-w-xs">
                      Configura tus plantas y espacio a la izquierda para ver el diseño detallado de tu huerta sostenible.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>

      {/* Gaspar Caballero Method Explanation */}
      <section className="bg-green-50/30 py-16 px-4 border-t border-green-100">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-[#2d3a2d] mb-6 flex items-center gap-3">
                <MapIcon className="text-green-600" /> El Método Gaspar Caballero
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  El método de <strong>"Parades en Crestall"</strong>, desarrollado por Gaspar Caballero de Segovia, es un sistema de cultivo ecológico diseñado para maximizar la producción en espacios mínimos con el menor esfuerzo posible.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-green-100">
                    <h4 className="font-bold text-green-800 mb-2">1. No Labrar</h4>
                    <p className="text-xs">Se respeta la estructura del suelo. Nunca se pisa la zona de cultivo para evitar la compactación.</p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-green-100">
                    <h4 className="font-bold text-green-800 mb-2">2. Compost (Crestall)</h4>
                    <p className="text-xs">Se aplica una capa de compost en el centro de la cama ("crestall") sin enterrarlo, alimentando la vida del suelo.</p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-green-100">
                    <h4 className="font-bold text-green-800 mb-2">3. Rotación Cuatrienal</h4>
                    <p className="text-xs">Las plantas se dividen en 4 grupos botánicos que rotan cada año para equilibrar nutrientes y evitar plagas.</p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-green-100">
                    <h4 className="font-bold text-green-800 mb-2">4. Siembra Densa</h4>
                    <p className="text-xs">Se plantan muy juntas para crear un microclima que retiene la humedad y evita el crecimiento de hierbas no deseadas.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full">
              <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-green-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 bg-green-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-bl-xl">
                  Diagrama Técnico
                </div>
                <h3 className="text-lg font-bold text-green-800 mb-4">Estructura de una "Parada"</h3>
                <div className="aspect-[4/3] bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-4 flex flex-col gap-2">
                  <div className="flex-1 border-2 border-green-200 rounded-lg flex items-center justify-center relative bg-green-50/30">
                    <span className="text-[10px] font-bold text-green-700 uppercase">Zona de Cultivo (1.5m ancho)</span>
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-orange-100 border-y border-orange-200 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-orange-700 uppercase">Pasillo de Baldosas (Crestall)</span>
                    </div>
                  </div>
                  <div className="h-8 border-2 border-gray-200 rounded-lg flex items-center justify-center bg-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Pasillo de Servicio</span>
                  </div>
                </div>
                <div className="mt-4 text-[10px] text-gray-500 italic">
                  * El pasillo central de baldosas permite acceder a todo el cultivo sin compactar la tierra. Las dimensiones son fijas para optimizar el riego.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-green-50 py-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-gray-500">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-2 text-[#2d3a2d] font-bold">
              <Sprout className="text-green-600" /> Permacultura Pro
            </div>
            <p>Agricultura regenerativa para un futuro sostenible.</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 font-semibold text-gray-700">
              <ShieldCheck size={18} className="text-green-600" /> 3 Emes del Suelo
            </div>
            <ul className="text-center">
              <li>Minerales (Harina de roca)</li>
              <li>Microorganismos Nativos</li>
              <li>Materia Orgánica</li>
            </ul>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="flex items-center gap-2 font-semibold text-gray-700">
              <Sun size={18} className="text-orange-500" /> Zonificación
            </div>
            <p className="text-center md:text-right">Ubicación inteligente según mantenimiento y luz solar.</p>
          </div>
        </div>
      </footer>

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 md:p-12"
            onClick={() => setSelectedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors z-[110]"
              onClick={() => setSelectedImage(null)}
            >
              <X size={48} strokeWidth={1.5} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={selectedImage} 
              alt="Vista ampliada" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
