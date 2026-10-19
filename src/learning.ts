import type { Diagram } from "./model";
import {
  solve,
  transfer,
  mul,
  add,
  div,
  sub,
  fraction,
  equal,
  latex,
  text,
  type Fraction,
} from "./engine";
export type LearningStep = {
  title: string;
  explanation: string;
  tex: string;
  diagram: Diagram;
};
const gain = (d: Diagram, id: string) => {
  const n = d.nodes.find((n) => n.id === id)!;
  return transfer(n.num, n.den);
};
function tidy(d: Diagram): Diagram {
  let result = structuredClone(d);
  for (let i = 0; i < 16; i++) {
    const n = result.nodes.find(
      (n) =>
        ["sum", "branch"].includes(n.kind) &&
        result.edges.filter((e) => e.to === n.id).length === 1 &&
        result.edges.filter((e) => e.from === n.id).length === 1 &&
        result.edges.find((e) => e.to === n.id)!.sign === 1,
    );
    if (!n) break;
    const a = result.edges.find((e) => e.to === n.id)!,
      b = result.edges.find((e) => e.from === n.id)!;
    if (a.from === b.to) break;
    result = {
      nodes: result.nodes.filter((v) => v.id !== n.id),
      edges: [
        ...result.edges.filter((e) => e.to !== n.id && e.from !== n.id),
        { ...b, from: a.from },
      ],
    };
  }
  return result;
}
export function buildLearning(
  original: Diagram,
  value: Fraction,
): { learning: LearningStep[]; learningNote: string } {
  let d = structuredClone(original);
  const learning: LearningStep[] = [];
  for (let iteration = 0; iteration < 12; iteration++) {
    let proposal:
      | {
          diagram: Diagram;
          title: string;
          explanation: string;
          value: Fraction;
        }
      | undefined;
    // Elementary unity/weighted feedback: sum -> G -> branch -> H -> sum.
    for (const q of d.nodes.filter((n) => n.kind === "sum")) {
      const inputs = d.edges.filter((e) => e.to === q.id),
        forward = d.edges.filter((e) => e.from === q.id);
      if (inputs.length !== 2 || forward.length !== 1) continue;
      const g = d.nodes.find((n) => n.id === forward[0].to);
      if (
        g?.kind !== "block" ||
        d.edges.filter((e) => e.to === g.id).length !== 1
      )
        continue;
      const gOut = d.edges.filter((e) => e.from === g.id);
      const p =
        gOut.length === 1 ? d.nodes.find((n) => n.id === gOut[0].to) : g;
      if (
        !p ||
        (p.id !== g.id &&
          (p.kind !== "branch" ||
            d.edges.filter((e) => e.to === p.id).length !== 1))
      )
        continue;
      for (const fb of inputs) {
        const h = d.nodes.find((n) => n.id === fb.from)!,
          hIn = d.edges.filter((e) => e.to === h.id);
        const direct = h.id === p.id;
        if (
          !direct &&
          (h.kind !== "block" ||
            hIn.length !== 1 ||
            hIn[0].from !== p.id ||
            d.edges.filter((e) => e.from === h.id).length !== 1)
        )
          continue;
        const external = inputs.find((e) => e.id !== fb.id)!;
        if (
          external.sign !== 1 ||
          external.from === g.id ||
          external.from === h.id ||
          external.from === p.id
        )
          continue;
        const G = gain(d, g.id),
          H = direct ? fraction("1") : gain(d, h.id),
          GH = mul(G, H);
        const total = div(
          G,
          fb.sign === -1 ? add(fraction("1"), GH) : sub(fraction("1"), GH),
        );
        const removed = new Set([q.id, ...(direct ? [] : [h.id])]);
        const diagram = tidy({
          nodes: d.nodes
            .filter((n) => !removed.has(n.id))
            .map((n) =>
              n.id === g.id ? { ...n, num: total.n, den: total.d } : n,
            ),
          edges: [
            ...d.edges.filter(
              (e) => !removed.has(e.from) && !removed.has(e.to),
            ),
            { ...external, to: g.id },
          ],
        });
        proposal = {
          diagram,
          title:
            fb.sign === -1
              ? "負フィードバックをまとめる"
              : "正フィードバックをまとめる",
          explanation: `G = ${text(G)}、H = ${text(H)}。${fb.sign === -1 ? "G/(1+G*H)" : "G/(1-G*H)"} を使って帰還ループを1つのブロックに置き換えます。`,
          value: total,
        };
        break;
      }
      if (proposal) break;
    }
    if (!proposal)
      for (const q of d.nodes.filter((n) => n.kind === "sum")) {
        const incoming = d.edges.filter((e) => e.to === q.id);
        if (incoming.length !== 2) continue;
        const [ea, eb] = incoming,
          [a, b] = incoming.map((e) => d.nodes.find((n) => n.id === e.from)!);
        if (a.kind !== "block" || b.kind !== "block" || a.id === b.id) continue;
        const ai = d.edges.filter((e) => e.to === a.id),
          bi = d.edges.filter((e) => e.to === b.id);
        if (
          ai.length !== 1 ||
          bi.length !== 1 ||
          ai[0].from !== bi[0].from ||
          d.edges.filter((e) => e.from === a.id).length !== 1 ||
          d.edges.filter((e) => e.from === b.id).length !== 1
        )
          continue;
        const A = mul(fraction(String(ea.sign)), gain(d, a.id)),
          B = mul(fraction(String(eb.sign)), gain(d, b.id)),
          total = add(A, B);
        const removed = new Set([b.id, q.id]);
        const diagram = tidy({
          nodes: d.nodes
            .filter((n) => !removed.has(n.id))
            .map((n) =>
              n.id === a.id ? { ...n, num: total.n, den: total.d } : n,
            ),
          edges: d.edges
            .filter(
              (e) => !removed.has(e.to) && e.from !== b.id && e.id !== ea.id,
            )
            .map((e) => (e.from === q.id ? { ...e, from: a.id } : e)),
        });
        proposal = {
          diagram,
          title: "並列ブロックをまとめる",
          explanation: `同じ信号を受ける2つの経路を、加算点の符号どおりに加えます：(${text(A)}) + (${text(B)})。`,
          value: total,
        };
        break;
      }
    if (!proposal)
      for (const e of d.edges) {
        const a = d.nodes.find((n) => n.id === e.from)!,
          b = d.nodes.find((n) => n.id === e.to)!;
        if (
          a.id === b.id ||
          a.kind !== "block" ||
          b.kind !== "block" ||
          d.edges.filter((v) => v.from === a.id).length !== 1 ||
          d.edges.filter((v) => v.to === b.id).length !== 1
        )
          continue;
        const A = gain(d, a.id),
          B = gain(d, b.id),
          total = mul(A, B);
        const diagram = tidy({
          nodes: d.nodes
            .filter((n) => n.id !== b.id)
            .map((n) =>
              n.id === a.id ? { ...n, num: total.n, den: total.d } : n,
            ),
          edges: d.edges
            .filter((v) => v.id !== e.id)
            .map((v) => (v.from === b.id ? { ...v, from: a.id } : v)),
        });
        proposal = {
          diagram,
          title: "直列ブロックをまとめる",
          explanation: `${a.label} と ${b.label} は途中に分岐のない直列接続なので、伝達関数を掛けます：(${text(A)}) × (${text(B)})。`,
          value: total,
        };
        break;
      }
    if (!proposal) break;
    try {
      const check = solve(proposal.diagram, false);
      if (!equal(check.value, value)) break;
      d = proposal.diagram;
      learning.push({
        title: proposal.title,
        explanation: proposal.explanation,
        tex: latex(proposal.value),
        diagram: d,
      });
    } catch {
      break;
    }
  }
  return {
    learning,
    learningNote:
      d.nodes.filter((n) => n.kind === "block").length === 1 &&
      d.nodes.length === 3
        ? "基本公式で単一ブロックまで整理できました。各段階で元の伝達関数との厳密一致を確認しています。"
        : "交差ループなど、基本公式だけで安全に整理できない部分は残しています。最終結果は連立方程式で求めています。",
  };
}
