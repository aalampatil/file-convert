import Link from "next/link";
export default function NotFound() {
  return (
    <main className="fallback-page">
      <h1>A page out of place.</h1>
      <p>This page could not be found.</p>
      <Link className="convert-button" href="/">
        Back to your workspace
      </Link>
    </main>
  );
}
