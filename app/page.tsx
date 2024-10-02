"use client";

import { useMemo, useState } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { v4 as uuidv4 } from "uuid";
import JSZip from "jszip";
import { Metadata } from "next";

interface IVideoInput {
  url: string;
  frame: number;
}

interface IImageData {
  url: string;
  filename: string;
}

export default function HomePage() {
  const [videos, setVideos] = useState<IVideoInput[]>([{ url: "", frame: 0 }]);
  const [images, setImages] = useState<IImageData[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const ffmpeg = useMemo(() => {
    if (typeof window === "undefined") return null;

    return createFFmpeg({
      log: true,
      corePath: `${window.location.origin}/ffmpeg/ffmpeg-core.js`,
    });
  }, []);

  // Function to remove a video input field
  function removeVideoInput(index: number) {
    setVideos((videos) => [...videos].splice(index, 1));
  }

  // Function to handle changes in the video input fields
  function handleVideoChange(
    index: number,
    field: keyof IVideoInput,
    value: string
  ) {
    setVideos((videos) => {
      const newVideos = videos.map((v, i) =>
        i === index
          ? { ...v, [field]: field === "frame" ? Number(value) : value }
          : v
      );

      return newVideos;
    });
  }

  // Function to process the videos
  async function handleProcess() {
    if (!ffmpeg) return;

    setIsProcessing(true);
    const newImages: IImageData[] = [];

    // Load ffmpeg if not already loaded
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    for (const video of videos) {
      try {
        const videoResponse = await fetch(video.url);
        const videoData = await videoResponse.arrayBuffer();

        // Write the video file to ffmpeg's virtual file system
        const inputFileName = `${uuidv4()}.mp4`;
        ffmpeg.FS("writeFile", inputFileName, new Uint8Array(videoData));

        // Generate a unique output filename
        const outputFileName = `${uuidv4()}.webp`;

        // Run ffmpeg command to extract the specified frame
        await ffmpeg.run(
          "-i",
          inputFileName,
          "-vf",
          `select=eq(n\\,${video.frame})`,
          "-vframes",
          "1",
          outputFileName
        );

        // Read the output file
        const data = ffmpeg.FS("readFile", outputFileName);

        // Convert the data to a base64 URL
        const blob = new Blob([data.buffer], { type: "image/webp" });
        const imageUrl = URL.createObjectURL(blob);

        // Extract the filename from the video URL
        const videoFileName = video.url.substring(
          video.url.lastIndexOf("/") + 1
        );
        // Replace the extension with .webp
        const imageFileName = videoFileName.replace(/\.[^/.]+$/, "") + ".webp";

        newImages.push({ url: imageUrl, filename: imageFileName });

        // Clean up the files from ffmpeg's file system
        ffmpeg.FS("unlink", inputFileName);
        ffmpeg.FS("unlink", outputFileName);
      } catch (error) {
        console.error("Error processing video:", error);
        alert(`There was an error processing the video: ${video.url}`);
      }
    }

    setImages(newImages);
    setIsProcessing(false);
  }

  // Function to download all images as a zip file
  async function handleDownloadAll() {
    const zip = new JSZip();

    for (const imageObj of images) {
      const { url, filename } = imageObj;

      // Fetch the image data as blob
      const response = await fetch(url);
      const blob = await response.blob();

      // Read the blob as arrayBuffer
      const arrayBuffer = await blob.arrayBuffer();

      // Add the image to the zip
      zip.file(filename, arrayBuffer);
    }

    // Generate the zip file
    const zipBlob = await zip.generateAsync({ type: "blob" });

    // Create a download link and click it to download the zip
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zipBlob);
    link.download = "images.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen flex justify-center bg-black text-white p-6">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl font-bold mb-6">Video Frame Extractor</h1>
        {videos.map((video, index) => (
          <div
            key={index}
            className="mb-4 flex flex-col md:flex-row items-center"
          >
            <input
              type="text"
              placeholder="Video URL"
              value={video.url}
              onChange={(e) => handleVideoChange(index, "url", e.target.value)}
              className="bg-gray-800 text-white p-2 mr-2 mb-2 md:mb-0 flex-1"
            />
            <input
              type="number"
              placeholder="Frame Number"
              value={video.frame}
              onChange={(e) =>
                handleVideoChange(index, "frame", e.target.value)
              }
              className="bg-gray-800 text-white p-2 mr-2 w-32"
            />
            <button
              onClick={() => removeVideoInput(index)}
              className="bg-red-600 p-2"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={() => setVideos([...videos, { url: "", frame: 0 }])}
          className="bg-blue-600 p-2 mb-6 mr-4"
        >
          Add Video
        </button>
        <button
          onClick={handleProcess}
          className="bg-green-600 p-2 mb-6"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Process"}
        </button>

        {images.length > 0 && (
          <>
            <h2 className="text-2xl mt-4 mb-4">Extracted Images</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {images.map((imageObj, index) => (
                <div key={index}>
                  <img
                    src={imageObj.url}
                    alt={`Extracted frame ${index + 1}`}
                    className="w-full"
                  />
                  <p className="mt-2 text-center">{imageObj.filename}</p>
                </div>
              ))}
            </div>
            <button
              onClick={handleDownloadAll}
              className="bg-yellow-600 p-2 mt-6"
            >
              Download All as ZIP
            </button>
          </>
        )}
      </div>
    </div>
  );
}
