/**
 * Executa um código ExtendScript dentro do After Effects através da ponte em tempo real (.ae_bridge)
 */
export declare function runExtendScript<T = any>(scriptBody: string): Promise<T>;
