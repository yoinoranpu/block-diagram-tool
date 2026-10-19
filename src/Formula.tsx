import katex from "katex";
export function Formula({
  tex,
  small = false,
}: {
  tex: string;
  small?: boolean;
}) {
  return (
    <div
      className={`formula ${small ? "small" : ""}`}
      role="math"
      aria-label={tex}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, {
          throwOnError: false,
          trust: false,
          output: "htmlAndMathml",
          displayMode: !small,
        }),
      }}
    />
  );
}
