/**
 * Retorna as Composições, Camadas de Texto e Camadas de Mídia do projeto atual.
 */
export declare function getProjectElements(): Promise<any>;
/**
 * Localiza composições por nome (busca parcial ou exata, sem diferenciar maiúsculas/minúsculas)
 */
export declare function findCompositions(query: string): Promise<any>;
/**
 * Altera o nome de uma composição existente
 */
export declare function renameComposition(currentName: string, newName: string): Promise<any>;
/**
 * Altera propriedades fundamentais de uma composição (Dimensões, Duração, FPS, Nome)
 */
export declare function updateCompositionSettings(compName: string, settings: {
    width?: number;
    height?: number;
    duration?: number;
    frameRate?: number;
    newName?: string;
}): Promise<any>;
/**
 * Atualiza o texto de uma camada dentro de uma composição específica
 */
export declare function updateTextLayer(compName: string, layerName: string, newText: string): Promise<any>;
/**
 * Substitui o arquivo base (footage) de uma camada específica
 */
export declare function replaceFootage(compName: string, layerName: string, newFilePath: string): Promise<any>;
/**
 * Substitui a origem (source) de uma camada por outro item do projeto (como uma pré-composição)
 */
export declare function replaceLayerSource(compName: string, layerName: string, newSourceName: string): Promise<any>;
/**
 * Envia uma composição para a fila de renderização (Render Queue)
 */
export declare function renderComposition(compName: string, outputPath: string): Promise<any>;
/**
 * Executa código ExtendScript customizado diretamente no After Effects
 */
export declare function runCustomScript(scriptCode: string): Promise<any>;
/**
 * Cria uma nova composição no projeto
 */
export declare function createComposition(name: string, width?: number, height?: number, duration?: number, frameRate?: number, pixelAspect?: number): Promise<any>;
/**
 * Cria uma nova camada de texto dentro de uma composição
 */
export declare function createTextLayer(compName: string, text: string, layerName?: string): Promise<any>;
/**
 * Cria uma camada de sólido (Solid) dentro de uma composição
 */
export declare function createSolidLayer(compName: string, layerName: string, color?: [number, number, number], width?: number, height?: number): Promise<any>;
/**
 * Renomeia todas as composições do projeto seguindo um padrão sequencial (ex: "comp_01", "comp_02")
 */
export declare function batchRenameCompositions(prefix?: string): Promise<any>;
/**
 * Anima a posição de uma camada ou de todas as camadas de texto de uma composição
 */
export declare function animatePosition(compName: string, startFrame: number, endFrame: number, startXPercent?: number, endXPercent?: number, layerName?: string): Promise<any>;
/**
 * Adiciona o efeito 'Fill' (Preenchimento) com cor personalizada a camadas de uma composição
 */
export declare function applyFillEffect(compName: string, color?: [number, number, number], layerName?: string): Promise<any>;
/**
 * Altera a família tipográfica (fonte) de camadas de texto no projeto ou em uma composição específica
 */
export declare function changeFont(fontFamily?: string, compName?: string): Promise<any>;
