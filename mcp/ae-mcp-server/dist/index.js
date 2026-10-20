import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as aeTools from "./tools.js";
// Definições dos Schemas Zod
const findCompSchema = z.object({
    query: z.string().describe("Termo de busca para encontrar composições pelo nome"),
});
const renameCompSchema = z.object({
    currentName: z.string().describe("Nome atual da composição"),
    newName: z.string().describe("Novo nome desejado para a composição"),
});
const batchRenameCompsSchema = z.object({
    prefix: z.string().optional().default("comp_").describe("Prefixo a ser usado para renomeação sequencial (padrão: 'comp_')"),
});
const animatePositionSchema = z.object({
    compName: z.string().describe("Nome da composição"),
    startFrame: z.number().describe("Frame de início da animação (ex: 20)"),
    endFrame: z.number().describe("Frame de fim da animação (ex: 120)"),
    startXPercent: z.number().optional().default(0.20).describe("Posição X inicial em porcentagem da largura (ex: 0.20 para 20%)"),
    endXPercent: z.number().optional().default(0.80).describe("Posição X final em porcentagem da largura (ex: 0.80 para 80%)"),
    layerName: z.string().optional().describe("Nome opcional da camada específica a ser animada (se omitido, anima todas as camadas de texto)"),
});
const applyFillEffectSchema = z.object({
    compName: z.string().describe("Nome da composição"),
    color: z.tuple([z.number(), z.number(), z.number()]).optional().describe("Cor RGB normalizada [0-1] (ex: [0.08, 0.52, 1.0])"),
    layerName: z.string().optional().describe("Nome da camada específica (opcional, padrão: todas as camadas de texto)"),
});
const changeFontSchema = z.object({
    fontFamily: z.string().optional().default("SegoeUI").describe("Nome da fonte (ex: 'Segoe UI', 'Arial', 'Montserrat', 'Impact')"),
    compName: z.string().optional().describe("Nome opcional da composição (se omitido, altera em todo o projeto)"),
});
const updateCompSettingsSchema = z.object({
    compName: z.string().describe("Nome da composição que será alterada"),
    width: z.number().optional().describe("Nova largura em pixels (ex: 1080)"),
    height: z.number().optional().describe("Nova altura em pixels (ex: 1920)"),
    duration: z.number().optional().describe("Nova duração em segundos (ex: 15.0)"),
    frameRate: z.number().optional().describe("Nova taxa de quadros por segundo (ex: 30, 60)"),
    newName: z.string().optional().describe("Novo nome da composição (opcional)"),
});
const createCompSchema = z.object({
    name: z.string().describe("Nome da nova composição"),
    width: z.number().optional().default(1920).describe("Largura em pixels (padrão: 1920)"),
    height: z.number().optional().default(1080).describe("Altura em pixels (padrão: 1080)"),
    duration: z.number().optional().default(10.0).describe("Duração em segundos (padrão: 10.0)"),
    frameRate: z.number().optional().default(30.0).describe("Taxa de quadros FPS (padrão: 30.0)"),
    pixelAspect: z.number().optional().default(1.0).describe("Proporção de pixel (padrão: 1.0)"),
});
const createTextLayerSchema = z.object({
    compName: z.string().describe("Nome da composição"),
    text: z.string().describe("Conteúdo do texto a ser inserido"),
    layerName: z.string().optional().describe("Nome customizado da camada de texto (opcional)"),
});
const createSolidLayerSchema = z.object({
    compName: z.string().describe("Nome da composição"),
    layerName: z.string().describe("Nome da camada sólida"),
    color: z.tuple([z.number(), z.number(), z.number()]).optional().describe("Cor RGB normalizada [0-1] (ex: [0.1, 0.1, 0.1])"),
    width: z.number().optional().describe("Largura do sólido (opcional, padrão: largura da comp)"),
    height: z.number().optional().describe("Altura do sólido (opcional, padrão: altura da comp)"),
});
const updateTextSchema = z.object({
    compName: z.string().describe("Nome da composição no After Effects"),
    layerName: z.string().describe("Nome da camada de texto que será alterada"),
    newText: z.string().describe("O novo texto que será inserido"),
});
const replaceFootageSchema = z.object({
    compName: z.string().describe("Nome da composição no After Effects"),
    layerName: z.string().describe("Nome da camada (footage) que será substituída"),
    newFilePath: z.string().describe("Caminho absoluto completo do novo arquivo de mídia"),
});
const replaceLayerSourceSchema = z.object({
    compName: z.string().describe("Nome da composição que contém a camada"),
    layerName: z.string().describe("Nome da camada cuja origem será trocada"),
    newSourceName: z.string().describe("Nome do novo item/composição de origem existente no projeto"),
});
const renderCompositionSchema = z.object({
    compName: z.string().describe("Nome da composição no After Effects"),
    outputPath: z.string().describe("Caminho absoluto completo onde o arquivo renderizado será salvo"),
});
const runCustomScriptSchema = z.object({
    script: z.string().describe("Código JavaScript/ExtendScript a ser executado no After Effects"),
});
class AfterEffectsMcpServer {
    server;
    constructor() {
        this.server = new Server({
            name: "after-effects-mcp",
            version: "1.2.0",
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "ae_get_project_elements",
                    description: "Retorna todas as Composições e suas respectivas camadas editáveis (Textos e Mídias) do projeto atualmente aberto no After Effects.",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "ae_create_composition",
                    description: "Cria uma nova composição no projeto do After Effects.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Nome da nova composição" },
                            width: { type: "number", description: "Largura em pixels (ex: 1920 ou 1080)" },
                            height: { type: "number", description: "Altura em pixels (ex: 1080 ou 1920)" },
                            duration: { type: "number", description: "Duração em segundos" },
                            frameRate: { type: "number", description: "Taxa de quadros FPS" },
                            pixelAspect: { type: "number", description: "Aspect ratio do pixel (padrão 1.0)" },
                        },
                        required: ["name"],
                    },
                },
                {
                    name: "ae_create_text_layer",
                    description: "Cria uma nova camada de texto dentro de uma composição.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            compName: { type: "string", description: "Nome da composição" },
                            text: { type: "string", description: "Texto a ser inserido" },
                            layerName: { type: "string", description: "Nome opcional para a camada" },
                        },
                        required: ["compName", "text"],
                    },
                },
                {
                    name: "ae_create_solid_layer",
                    description: "Cria uma camada de cor sólida dentro de uma composição.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            compName: { type: "string", description: "Nome da composição" },
                            layerName: { type: "string", description: "Nome da camada" },
                            color: { type: "array", items: { type: "number" }, description: "Array [R, G, B] normalizado de 0 a 1" },
                            width: { type: "number" },
                            height: { type: "number" },
                        },
                        required: ["compName", "layerName"],
                    },
                },
                {
                    name: "ae_find_composition",
                    description: "Localiza e retorna detalhes de composições pelo nome (busca parcial ou completa).",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: { type: "string" },
                        },
                        required: ["query"],
                    },
                },
                {
                    name: "ae_rename_composition",
                    description: "Altera o nome de uma composição existente.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            currentName: { type: "string" },
                            newName: { type: "string" },
                        },
                        required: ["currentName", "newName"],
                    },
                },
                {
                    name: "ae_batch_rename_compositions",
                    description: "Renomeia todas as composições do projeto em lote para o padrão 'comp_01', 'comp_02', etc.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prefix: { type: "string", description: "Prefixo do nome (padrão: 'comp_')" },
                        },
                    },
                },
                {
                    name: "ae_update_composition_settings",
                    description: "Altera propriedades de uma composição como dimensões (largura/altura), duração, frame rate ou nome.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            compName: { type: "string" },
                            width: { type: "number" },
                            height: { type: "number" },
                            duration: { type: "number" },
                            frameRate: { type: "number" },
                            newName: { type: "string" },
                        },
                        required: ["compName"],
                    },
                },
                {
                    name: "ae_update_text_layer",
                    description: "Altera o conteúdo de texto de uma camada de texto específica dentro de uma composição.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            compName: { type: "string" },
                            layerName: { type: "string" },
                            newText: { type: "string" },
                        },
                        required: ["compName", "layerName", "newText"],
                    },
                },
                {
                    name: "ae_animate_position",
                    description: "Cria keyframes de animação de Position no eixo X para uma camada ou para todas as camadas de texto de uma composição.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            compName: { type: "string" },
                            startFrame: { type: "number" },
                            endFrame: { type: "number" },
                            startXPercent: { type: "number" },
                            endXPercent: { type: "number" },
                            layerName: { type: "string" },
                        },
                        required: ["compName", "startFrame", "endFrame"],
                    },
                },
                {
                    name: "ae_apply_fill_effect",
                    description: "Adiciona o efeito 'Fill' (Preenchimento) com cor personalizada a camadas de uma composição.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            compName: { type: "string" },
                            color: { type: "array", items: { type: "number" }, description: "Array [R, G, B] normalizado de 0 a 1" },
                            layerName: { type: "string" },
                        },
                        required: ["compName"],
                    },
                },
                {
                    name: "ae_change_font",
                    description: "Altera a família da fonte (typography) de camadas de texto no projeto inteiro ou em uma composição específica.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            fontFamily: { type: "string", description: "Nome da fonte (padrão: 'Segoe UI')" },
                            compName: { type: "string", description: "Nome opcional da composição" },
                        },
                    },
                },
                {
                    name: "ae_replace_footage",
                    description: "Substitui o arquivo de mídia/footage de uma camada no projeto.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            compName: { type: "string" },
                            layerName: { type: "string" },
                            newFilePath: { type: "string" },
                        },
                        required: ["compName", "layerName", "newFilePath"],
                    },
                },
                {
                    name: "ae_replace_layer_source",
                    description: "Substitui a fonte/origem de uma camada por outra composição/item existente no projeto.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            compName: { type: "string" },
                            layerName: { type: "string" },
                            newSourceName: { type: "string" },
                        },
                        required: ["compName", "layerName", "newSourceName"],
                    },
                },
                {
                    name: "ae_render_composition",
                    description: "Adiciona uma composição à fila de renderização (Render Queue) do After Effects configurando o caminho do arquivo de saída.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            compName: { type: "string" },
                            outputPath: { type: "string" },
                        },
                        required: ["compName", "outputPath"],
                    },
                },
                {
                    name: "ae_run_custom_script",
                    description: "Executa um script ExtendScript customizado diretamente no After Effects para tarefas avançadas.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            script: { type: "string" },
                        },
                        required: ["script"],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                switch (request.params.name) {
                    case "ae_get_project_elements": {
                        const result = await aeTools.getProjectElements();
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_create_composition": {
                        const args = createCompSchema.parse(request.params.arguments);
                        const result = await aeTools.createComposition(args.name, args.width, args.height, args.duration, args.frameRate, args.pixelAspect);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_create_text_layer": {
                        const args = createTextLayerSchema.parse(request.params.arguments);
                        const result = await aeTools.createTextLayer(args.compName, args.text, args.layerName);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_create_solid_layer": {
                        const args = createSolidLayerSchema.parse(request.params.arguments);
                        const result = await aeTools.createSolidLayer(args.compName, args.layerName, args.color, args.width, args.height);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_find_composition": {
                        const args = findCompSchema.parse(request.params.arguments);
                        const result = await aeTools.findCompositions(args.query);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_rename_composition": {
                        const args = renameCompSchema.parse(request.params.arguments);
                        const result = await aeTools.renameComposition(args.currentName, args.newName);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_batch_rename_compositions": {
                        const args = batchRenameCompsSchema.parse(request.params.arguments || {});
                        const result = await aeTools.batchRenameCompositions(args.prefix);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_update_composition_settings": {
                        const args = updateCompSettingsSchema.parse(request.params.arguments);
                        const result = await aeTools.updateCompositionSettings(args.compName, {
                            width: args.width,
                            height: args.height,
                            duration: args.duration,
                            frameRate: args.frameRate,
                            newName: args.newName,
                        });
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_update_text_layer": {
                        const args = updateTextSchema.parse(request.params.arguments);
                        const result = await aeTools.updateTextLayer(args.compName, args.layerName, args.newText);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_animate_position": {
                        const args = animatePositionSchema.parse(request.params.arguments);
                        const result = await aeTools.animatePosition(args.compName, args.startFrame, args.endFrame, args.startXPercent, args.endXPercent, args.layerName);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_apply_fill_effect": {
                        const args = applyFillEffectSchema.parse(request.params.arguments);
                        const result = await aeTools.applyFillEffect(args.compName, args.color, args.layerName);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_change_font": {
                        const args = changeFontSchema.parse(request.params.arguments || {});
                        const result = await aeTools.changeFont(args.fontFamily, args.compName);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_replace_footage": {
                        const args = replaceFootageSchema.parse(request.params.arguments);
                        const result = await aeTools.replaceFootage(args.compName, args.layerName, args.newFilePath);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_replace_layer_source": {
                        const args = replaceLayerSourceSchema.parse(request.params.arguments);
                        const result = await aeTools.replaceLayerSource(args.compName, args.layerName, args.newSourceName);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_render_composition": {
                        const args = renderCompositionSchema.parse(request.params.arguments);
                        const result = await aeTools.renderComposition(args.compName, args.outputPath);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    case "ae_run_custom_script": {
                        const args = runCustomScriptSchema.parse(request.params.arguments);
                        const result = await aeTools.runCustomScript(args.script);
                        return {
                            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        };
                    }
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, "Ferramenta desconhecida: " + request.params.name);
                }
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Erro ao executar a ferramenta AE: " + error.message,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Servidor MCP de After Effects iniciado na stdio.");
    }
}
const server = new AfterEffectsMcpServer();
server.run().catch((error) => {
    console.error("Erro fatal ao iniciar o servidor MCP:", error);
    process.exit(1);
});
