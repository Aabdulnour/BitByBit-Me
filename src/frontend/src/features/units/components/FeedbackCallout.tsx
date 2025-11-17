import React from "react";

export default function FeedbackCallout({
  message,
  title = "Personalized feedback",
}: {
  message?: string | null;
  title?: string;
}) {
  if (!message) return null;
  return (
    <div>
      <p className="muted tiny helper-text">{title}</p>
      <p style={{ margin: "4px 0 0" }}>{message}</p>
    </div>
  );
}
