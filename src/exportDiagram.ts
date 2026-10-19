import type { diagramBounds } from "./routing";
export async function downloadDiagram(
  svg: SVGSVGElement,
  bounds: ReturnType<typeof diagramBounds>,
  format: "svg" | "png",
) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute(
    "viewBox",
    `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
  );
  copy.setAttribute("width", String(Math.ceil(bounds.width)));
  copy.setAttribute("height", String(Math.ceil(bounds.height)));
  copy.querySelectorAll(".export-hide,.port,title").forEach((n) => n.remove());
  copy.querySelectorAll(".selected,.muted").forEach((n) => {
    n.classList.remove("selected", "muted");
  });
  copy.querySelectorAll("[tabindex],[role],[aria-label]").forEach((n) => {
    n.removeAttribute("tabindex");
    n.removeAttribute("role");
    n.removeAttribute("aria-label");
  });
  const ns = "http://www.w3.org/2000/svg";
  const style = document.createElementNS(ns, "style");
  style.textContent = `text{font-family:Arial,"Hiragino Kaku Gothic ProN",sans-serif;fill:#24334a}.wire{fill:none;stroke:#53677f;stroke-width:1.8}.wire-underlay{fill:none;stroke:#fff;stroke-width:7}.node-body{fill:#fff;stroke:#607991;stroke-width:1.5}.terminal-body{fill:#f4f7fa;stroke:#8ca0b7;stroke-width:1.3}.branch-body{fill:#334d68}.node-label{font-size:14px;font-weight:600}.node-expression{font-family:"Cambria Math","Times New Roman",serif;font-size:15px}.terminal-label{font-size:12px}.sign-button circle{fill:#fff;stroke:none}`;
  copy.insertBefore(style, copy.firstChild);
  const background = document.createElementNS(ns, "rect");
  for (const [key, value] of Object.entries({ ...bounds, fill: "#fff" }))
    background.setAttribute(key, String(value));
  copy.insertBefore(background, copy.querySelector("g"));
  const blob = new Blob([new XMLSerializer().serializeToString(copy)], {
    type: "image/svg+xml;charset=utf-8",
  });
  let output = blob;
  if (format === "png") {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(
            new Error("画像を作成できませんでした。SVG保存を試してください。"),
          );
        image.src = url;
      });
      const scale = Math.min(2, 4000 / bounds.width, 4000 / bounds.height),
        canvas = document.createElement("canvas");
      canvas.width = Math.ceil(bounds.width * scale);
      canvas.height = Math.ceil(bounds.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("PNG作成に対応していません。SVG保存を使ってください。");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      output = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("PNGを保存できませんでした。")),
          "image/png",
        ),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const url = URL.createObjectURL(output),
    link = document.createElement("a");
  link.href = url;
  link.download = `control-diagram.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
