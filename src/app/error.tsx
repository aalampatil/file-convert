"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fallback-page">
      <h1>A small interruption.</h1>
      <p>We could not load your workspace. Please try again.</p>
      <button className="convert-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
