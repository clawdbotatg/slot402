import type { Metadata } from "next";

const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `http://localhost:${process.env.PORT || 3000}`;
const titleTemplate = "%s | Based Slot";

export const getMetadata = ({
  title,
  description,
  imageRelativePath = "/preview.png",
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
}): Metadata => {
  const imageUrl = `${baseUrl}${imageRelativePath}`;

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: title,
      template: titleTemplate,
    },
    description: description,
    openGraph: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [
        {
          url: imageUrl,
        },
      ],
    },
    twitter: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [imageUrl],
    },
    icons: {
      icon: [
        {
          url: "/favicon.png",
          sizes: "32x32",
          type: "image/png",
        },
      ],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "next",
        imageUrl,
        button: {
          title: "Play Slot402",
          action: {
            type: "launch_miniapp",
            name: "Slot402",
            url: "https://slot402-mini.vercel.app/",
            splashImageUrl: `https://slot402-mini.vercel.app/splash.png`,
            splashBackgroundColor: "#1C3C45",
          },
        },
      }),
    },
  };
};
