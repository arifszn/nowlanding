/* eslint-disable @next/next/no-img-element */
const IMG = "https://image.tmdb.org/t/p";

export function Poster({ path, name, size = "w185", frame = false, priority = false }: {
  path: string | null | undefined;
  name: string;
  size?: "w92" | "w154" | "w185" | "w342" | "w500";
  frame?: boolean;
  priority?: boolean;
}) {
  return (
    <div className={frame ? "poster poster--frame" : "poster"}>
      {path ? (
        <img src={`${IMG}/${size}${path}`} alt={`${name} poster`} loading={priority ? "eager" : "lazy"} decoding="async" />
      ) : (
        <span className="poster__none">No poster</span>
      )}
    </div>
  );
}
