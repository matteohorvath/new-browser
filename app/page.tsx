"use client";
import { useState, useEffect, useRef } from "react";

function App() {
  const [urlParam, setUrlParam] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pageContent, setPageContent] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const _url = searchParams.get("_url");
    setUrlParam(_url);
  }, []);

  const processWithGemini = async (htmlContent: string) => {
    setStatusMessage("Processing with AI...");
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ htmlContent, originalUrl: urlParam }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API Error:", data.error, data.details);
        setPageContent(null);
        setStatusMessage(
          `Error: AI processing failed - ${data.error || response.statusText}`
        );
      } else {
        console.log("Gemini API Response:", data);
        if (data.modifiedContent) {
          setPageContent(data.modifiedContent);
          setStatusMessage("Success: AI processing complete.");
        } else {
          setPageContent(htmlContent);
          setStatusMessage(
            "Warning: AI processing returned no content, showing original."
          );
        }
      }
    } catch (error) {
      console.error("Gemini API fetch error:", error);
      setPageContent(null);
      setStatusMessage("Error: Failed to contact AI processing service.");
    }
  };

  useEffect(() => {
    if (urlParam) {
      const downloadUrl = async () => {
        setStatusMessage("Downloading page content...");
        setPageContent(null);
        try {
          const response = await fetch(
            `/api/download?url=${encodeURIComponent(urlParam)}`
          );
          const data = await response.json();

          if (!response.ok) {
            console.error("Download API Error:", data.error, data.details);
            setStatusMessage(
              `Error downloading: ${data.error || response.statusText}`
            );
          } else {
            console.log("Download API Response:", data);
            if (data.content) {
              await processWithGemini(data.content);
            } else {
              setStatusMessage(
                "Success: Received response but no content found."
              );
            }
          }
        } catch (error) {
          console.error("Download Fetch error:", error);
          setStatusMessage("Error: Failed to contact download service.");
        }
      };
      downloadUrl();
    } else {
      setStatusMessage(null);
    }
  }, [urlParam]);

  return (
    <>
      {urlParam && <p>Requesting content for: {urlParam}</p>}
      {statusMessage && <p>Status: {statusMessage}</p>}
      {pageContent && (
        <div
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: pageContent }}
          style={{
            width: "100%",
            height: "80vh",
            border: "1px solid #ccc",
            overflow: "auto",
          }}
        />
      )}
    </>
  );
}

export default App;
