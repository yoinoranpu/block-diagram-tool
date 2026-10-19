import { it, expect } from "vitest";
import { generate, equal, transfer } from "./engine";
import { routeEdges, type RoutedEdge } from "./routing";

import { cases } from "./formulaCases";
function overlaps(routes: RoutedEdge[]) {
  let count = 0;
  for (let i = 0; i < routes.length; i++)
    for (let j = i + 1; j < routes.length; j++) {
      if (routes[i].edge.from === routes[j].edge.from) continue;
      for (let a = 1; a < routes[i].points.length; a++)
        for (let b = 1; b < routes[j].points.length; b++) {
          const p = routes[i].points[a - 1],
            q = routes[i].points[a],
            r = routes[j].points[b - 1],
            s = routes[j].points[b];
          if (
            p.x === q.x &&
            r.x === s.x &&
            p.x === r.x &&
            Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) -
              Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y)) >
              1
          )
            count++;
          if (
            p.y === q.y &&
            r.y === s.y &&
            p.y === r.y &&
            Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x)) -
              Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x)) >
              1
          )
            count++;
        }
    }
  return count;
}
it("12種類の式・全生成方式の配線と計算結果を監査", () => {
  const report = [];
  for (const [num, den] of cases) {
    for (const c of generate(num, den).candidates) {
      const routes = routeEdges(c.diagram);
      expect(equal(c.result.value, transfer(num, den))).toBe(true);
      report.push({
        num,
        den,
        title: c.title,
        corners: routes.reduce(
          (n, r) => n + Math.max(0, r.points.length - 2),
          0,
        ),
        overlaps: overlaps(routes),
        obstructed: routes.filter((r) => r.obstructed).length,
        diagram: c.diagram,
      });
    }
  }
  expect(report.every((r) => r.overlaps === 0 && r.obstructed === 0)).toBe(
    true,
  );
  expect(report.reduce((n, r) => n + r.corners, 0)).toBeLessThanOrEqual(150);
});
