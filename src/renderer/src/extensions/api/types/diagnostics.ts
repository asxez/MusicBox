import {DiagnosticCollection, DiagnosticSeverity} from "@extensions/api";

export type DiagnosticSeverityValue = typeof DiagnosticSeverity[keyof typeof DiagnosticSeverity];

interface Position {
    line: number;
    character: number;
}

interface Range {
    start: Position;
    end: Position;
}

export interface DiagnosticRelatedInformation {
    location: {
        uri: string;
        range: Range;
    };
    message: string;
}

export interface DiagnosticsAPI {
    /**
     * 创建诊断集合
     */
    createDiagnosticCollection(name: string): DiagnosticCollection;

    /**
     * 获取所有诊断集合
     */
    getDiagnosticCollections(): DiagnosticCollection[];
}
