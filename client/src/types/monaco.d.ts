// Monaco编辑器类型声明
declare module 'monaco-editor' {
  export namespace editor {
    export interface IStandaloneCodeEditor {
      getSelection(): Range | null;
      getModel(): any;
      executeEdits(source: string, edits: Array<{range: Range; text: string}>): boolean;
      focus(): void;
      setPosition(position: Position): void;
      setSelection(selection: Selection): void;
      getPosition(): Position | null;
      deltaDecorations(oldDecorations: string[], newDecorations: any[]): string[];
      trigger(source: string, handlerId: string, payload: any): void;
      addCommand(keybinding: number, handler: () => void): string | null;
      getLayoutInfo(): { width: number; height: number; glyphMarginLeft: number; glyphMarginWidth: number; lineNumbersWidth: number; decorationsWidth: number; contentLeft: number; contentWidth: number; };
      getScrollHeight(): number;
      getScrollInfo(): { scrollWidth: number; scrollHeight: number; scrollLeft: number; scrollTop: number; };
      getScrollTop(): number;
      onDidScrollChange(listener: (e: any) => void): { dispose: () => void };
      setScrollTop(scrollTop: number): void;
      setValue(value: string): void;
    }

    export interface Position {
      lineNumber: number;
      column: number;
    }

    export interface Range {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    }

    export interface Selection extends Range {
      positionLineNumber: number;
      positionColumn: number;
    }
  }

  export const KeyMod: {
    CtrlCmd: number;
    Shift: number;
    Alt: number;
    WinCtrl: number;
  };

  export const KeyCode: {
    KeyB: number;
    KeyI: number;
    KeyK: number;
    KeyS: number;
    Tab: number;
    Backquote: number;
  };

  // 添加构造函数声明
  export const Position: {
    new(lineNumber: number, column: number): editor.Position;
  };

  export const Range: {
    new(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number): editor.Range;
  };

  export const Selection: {
    new(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number): editor.Selection;
  };
}

declare module '@monaco-editor/react' {
  import * as React from 'react';
  import { editor } from 'monaco-editor';

  export interface EditorProps {
    height?: string | number;
    width?: string | number;
    value?: string;
    defaultValue?: string;
    language?: string;
    defaultLanguage?: string; // 添加缺少的属性
    theme?: string;
    options?: any;
    onMount?: (editor: editor.IStandaloneCodeEditor, monaco: any) => void;
    onChange?: (value: string | undefined, event: any) => void;
    className?: string;
  }

  export default function Editor(props: EditorProps): React.ReactElement;
} 