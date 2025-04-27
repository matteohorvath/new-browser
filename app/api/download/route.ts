import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    );
  }

  let targetUrl = url;
  // Ensure the URL has a protocol
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    const response = await fetch(targetUrl);

    // Check if the fetch was successful
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: response.status }
      );
    }

    // For simplicity, let's return the status and content type for now.
    // You might want to stream the content or return it directly depending on the use case.
    const contentType = response.headers.get("content-type") || "unknown";
    const status = response.status;
    const content = await response.text(); // Read the response body as text

    // Return status, content type, and the actual content
    return NextResponse.json({ status, contentType, content });
  } catch (error) {
    console.error("Error fetching URL:", error);
    let errorMessage = "Internal Server Error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: "Failed to fetch URL", details: errorMessage },
      { status: 500 }
    );
  }
}
