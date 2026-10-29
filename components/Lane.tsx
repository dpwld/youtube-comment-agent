/** 세 칸 공통 구조: 작은 라벨 → 큰 제목 → 설명 → (버튼) → 내용 */
export default function Lane({
  step, title, lead, tone = "white", actions, children,
}: {
  step: string; title: string; lead: string; tone?: "white" | "mint";
  actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className={`flex min-h-[72vh] flex-col rounded-2xl border border-line lg:h-[calc(100vh-88px)] lg:min-h-[560px] ${tone === "mint" ? "bg-mint" : "bg-white"}`}>
      <div className="p-6 pb-4">
        <span className="inline-block rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent-deep">{step}</span>
        <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{lead}</p>
        {actions && <div className="mt-4">{actions}</div>}
      </div>
      <div className="flex-1 overflow-y-auto border-t border-line/70">{children}</div>
    </section>
  );
}
