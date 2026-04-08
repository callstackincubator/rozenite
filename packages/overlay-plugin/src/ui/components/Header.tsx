import { Layers } from 'lucide-react';

export const Header = () => {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 rounded-[1.75rem] border border-white/10 bg-[rgba(10,25,38,0.82)] px-5 py-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--overlay-line-strong)] bg-[linear-gradient(180deg,rgba(130,50,255,0.26),rgba(130,50,255,0.08))] text-[var(--overlay-accent)]">
          <Layers size={22} />
        </div>
        <div className="min-w-0">
          <h1 className="m-0 text-lg font-semibold tracking-tight text-white">
            Overlay Controls
          </h1>
        </div>
      </div>
    </header>
  );
};
