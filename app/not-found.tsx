import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page container">
      <div className="empty">
        <h2>No such title</h2>
        <p>The link may be old, or the title was removed.</p>
        <Link className="btn" href="/discover">Go to Discover</Link>
      </div>
    </div>
  );
}
