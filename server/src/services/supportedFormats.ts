export type SupportedFormatsResponse = {
  groups: Array<{
    id: "image" | "text" | "other";
    title: string;
    inputExamples: string[];
    outputs: string[];
    note?: string;
  }>;
};

export function supportedFormats(): SupportedFormatsResponse {
  return {
    groups: [
      {
        id: "image",
        title: "Images",
        inputExamples: ["png", "jpg", "jpeg", "webp"],
        outputs: ["png", "jpg", "webp"]
      },
      {
        id: "text",
        title: "Text",
        inputExamples: ["txt"],
        outputs: ["pdf"],
        note: "txt → pdf uses a simple PDF renderer."
      },
      {
        id: "other",
        title: "Fallback",
        inputExamples: ["*"],
        outputs: ["*"],
        note: "Unsupported conversions return the original file with a new extension."
      }
    ]
  };
}

