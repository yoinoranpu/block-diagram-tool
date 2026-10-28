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
  type Fraction,
} from "./engine";
export type LearningDetail = { title: string; explanation: string; tex: string };
export type LearningStep = {
  title: string;
  explanation: string;
  tex: string;
  diagram: Diagram;
  details: LearningDetail[];
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
  const displayCache = new Map<string, string>();
  const display = (value: Fraction): string => {
    const key = JSON.stringify([value.n, value.d]);
    let tex = displayCache.get(key);
    if (tex === undefined) {
      tex = latex(value, true);
      displayCache.set(key, tex);
    }
    return tex;
  };
  for (let iteration = 0; iteration < 12; iteration++) {
    let proposal:
      | {
          diagram: Diagram;
          title: string;
          explanation: string;
          value: Fraction;
          details: () => LearningDetail[];
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
          explanation: `出力の一部が加算点へ戻る帰還ループです。戻り入力が${fb.sign === -1 ? "−なので、戻ってきた信号を入力から引きます" : "＋なので、戻ってきた信号を入力に足します"}。この部分を同じ入出力関係の1ブロックにまとめます。`,
          details: () => [
            { title: "1. 関係式を立てる", explanation: "Eを加算点直後、Uをこの部分への入力、Yを出力とします。Gは順方向、Hは戻り経路の伝達関数です。", tex: String.raw`E=U${fb.sign === -1 ? '-' : '+'}HY,\qquad Y=GE` },
            { title: "2. 使う公式", explanation: "Eを消去し、Yを含む項を左にまとめてから入力Uで割ります。帰還入力の符号と、公式の分母の符号が逆になる点を確認してください。", tex: String.raw`G_{\mathrm{eq}}=\frac{G}{1${fb.sign === -1 ? '+' : '-'}GH}` },
            { title: "3. 入力した式を代入", explanation: "順方向と戻り経路の伝達関数を、公式のGとHに当てはめます。", tex: String.raw`\begin{gathered}G=${display(G)},\quad H=${display(H)}\\[6pt] G_{\mathrm{eq}}=\frac{\left(${display(G)}\right)}{1${fb.sign === -1 ? '+' : '-'}\left(${display(G)}\right)\left(${display(H)}\right)}\end{gathered}` },
            { title: "4. 整理した結果", explanation: "分数を通分して整理すると、この部分の等価伝達関数が得られます。", tex: String.raw`G_{\mathrm{eq}}=${display(total)}` },
          ],
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
          explanation: "2つの経路に同じ入力が入り、それぞれの出力が加算点で合流しています。そのため、加算点の＋／−を反映した伝達関数の和に置き換えられます。",
          details: () => [
            { title: "1. 関係式を立てる", explanation: "同じ入力Uに対する各経路の出力をY₁、Y₂とします。ε₁、ε₂は加算点の符号（＋1または−1）です。", tex: String.raw`Y_1=G_1U,\quad Y_2=G_2U,\quad Y=\varepsilon_1Y_1+\varepsilon_2Y_2` },
            { title: "2. 使う公式", explanation: "共通の入力Uでくくってから割ると、符号付きの和になります。", tex: String.raw`G_{\mathrm{eq}}=\varepsilon_1G_1+\varepsilon_2G_2` },
            { title: "3. 入力した式を代入", explanation: "次の2つの式には、加算点の符号をすでに反映しています。分母が異なる場合は通分します。", tex: String.raw`G_{\mathrm{eq}}=\left(${display(A)}\right)+\left(${display(B)}\right)` },
            { title: "4. 整理した結果", explanation: "分母をそろえて分子を足し、この部分を1ブロックにまとめます。", tex: String.raw`G_{\mathrm{eq}}=${display(total)}` },
          ],
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
          explanation: `${a.label} と ${b.label} は途中に分岐のない直列接続です。前のブロックの出力が、そのまま次のブロックの入力になるので、伝達関数の積に置き換えられます。`,
          details: () => [
            { title: "1. 関係式を立てる", explanation: "2ブロックの間の信号をVとします。最初の出力Vを、次のブロックの入力として使います。", tex: String.raw`V=G_1U,\qquad Y=G_2V` },
            { title: "2. 使う公式", explanation: "Vを代入するとY=G₂G₁Uとなるので、入力Uで割ります。ここでは1入力1出力の伝達関数を扱っています。", tex: String.raw`G_{\mathrm{eq}}=G_2G_1` },
            { title: "3. 入力した式を代入", explanation: "各ブロックの式を掛け合わせます。分子同士、分母同士をそれぞれ掛けます。", tex: String.raw`G_{\mathrm{eq}}=\left(${display(B)}\right)\left(${display(A)}\right)` },
            { title: "4. 整理した結果", explanation: "積を整理し、この2ブロックを同じ入出力関係の1ブロックにまとめます。", tex: String.raw`G_{\mathrm{eq}}=${display(total)}` },
          ],
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
        details: proposal.details(),
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
