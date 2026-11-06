"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null; resetKey: number };

export class UploadErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  private reset = () => {
    this.setState((current) => ({ error: null, resetKey: current.resetKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-16">
          <p className="text-xs font-medium tracking-[0.18em] text-[#e39b4b] uppercase">SpriteForge</p>
          <h1 className="text-2xl font-semibold text-[#ece7df]">파일을 처리하다 멈췄습니다.</h1>
          <p className="text-sm leading-6 text-[#9aa3b5]">{this.state.error.message}</p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-2 h-11 rounded-lg bg-[#e39b4b] px-4 text-sm font-semibold text-[#1a1208] transition hover:bg-[#f0b36a]"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}
