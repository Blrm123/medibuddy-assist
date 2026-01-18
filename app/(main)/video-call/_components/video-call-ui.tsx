"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  User,
} from "lucide-react";
import { toast } from "sonner";

interface OTLike {
  initSession: (apiKey: string, sessionId: string) => unknown;
  initPublisher: (
    targetElement: string,
    options: {
      insertMode: string;
      width: string;
      height: string;
      publishAudio: boolean;
      publishVideo: boolean;
    },
    cb: (error?: unknown) => void
  ) => unknown;
}

interface OTSession {
  on: (event: string, cb: (event: { stream: unknown }) => void) => void;
  subscribe: (
    stream: unknown,
    targetElement: string,
    options: { insertMode: string; width: string; height: string },
    cb: (error?: unknown) => void
  ) => void;
  connect: (token: string, cb: (error?: unknown) => void) => void;
  publish: (publisher: OTPublisher, cb: (error?: unknown) => void) => void;
  disconnect: () => void;
}

interface OTPublisher {
  publishVideo: (enabled: boolean) => void;
  publishAudio: (enabled: boolean) => void;
  destroy: () => void;
}

type WindowWithOT = Window & { OT?: OTLike };

interface VideoCallProps {
  sessionId: string;
  token: string;
}

export default function VideoCall({ sessionId, token }: VideoCallProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [hasPublisher, setHasPublisher] = useState(false);

  const sessionRef = useRef<OTSession | null>(null);
  const publisherRef = useRef<OTPublisher | null>(null);

  const router = useRouter();

  const appId = process.env.NEXT_PUBLIC_VONAGE_APPLICATION_ID;

  // Handle script load
  const handleScriptLoad = () => {
    setScriptLoaded(true);
    const ot = (window as WindowWithOT).OT;
    if (!ot) {
      toast.error("Failed to load Vonage Video API");
      setIsLoading(false);
      return;
    }
    initializeSession();
  };

  // Initialize video session
  const initializeSession = () => {
    if (!appId || !sessionId || !token) {
      toast.error("Missing required video call parameters");
      router.push("/appointments");
      return;
    }

    console.log({ appId, sessionId, token });

    try {
      // Initialize the session
      const ot = (window as WindowWithOT).OT;
      if (!ot) {
        toast.error("Failed to load Vonage Video API");
        setIsLoading(false);
        return;
      }

      const session = ot.initSession(appId, sessionId) as OTSession;
      sessionRef.current = session;

      // Subscribe to new streams
      session.on("streamCreated", (event) => {
        console.log(event, "New stream created");

        session.subscribe(
          event.stream,
          "subscriber",
          {
            insertMode: "append",
            width: "100%",
            height: "100%",
          },
          (error) => {
            if (error) {
              toast.error("Error connecting to other participant's stream");
            }
          }
        );
      });

      // Handle session events
      session.on("sessionConnected", () => {
        setIsConnected(true);
        setIsLoading(false);

        // THIS IS THE FIX - Initialize publisher AFTER session connects
        const otInner = (window as WindowWithOT).OT;
        if (!otInner) {
          toast.error("Failed to load Vonage Video API");
          return;
        }

        const publisher = otInner.initPublisher(
          "publisher", // This targets the div with id="publisher"
          {
            insertMode: "replace", // Change from "append" to "replace"
            width: "100%",
            height: "100%",
            publishAudio: isAudioEnabled,
            publishVideo: isVideoEnabled,
          },
          (error) => {
            if (error) {
              console.error("Publisher error:", error);
              toast.error("Error initializing your camera and microphone");
            } else {
              console.log(
                "Publisher initialized successfully - you should see your video now"
              );
            }
          }
        );

        publisherRef.current = publisher as OTPublisher;
        setHasPublisher(true);
      });

      session.on("sessionDisconnected", () => {
        setIsConnected(false);
        setHasPublisher(false);
      });

      // Connect to the session
      session.connect(token, (error) => {
        if (error) {
          toast.error("Error connecting to video session");
        } else {
          // Publish your stream AFTER connecting
          if (publisherRef.current) {
            session.publish(publisherRef.current, (publishError) => {
              if (publishError) {
                console.log("Error publishing stream:", publishError);
                toast.error("Error publishing your stream");
              } else {
                console.log("Stream published successfully");
              }
            });
          }
        }
      });
    } catch {
      toast.error("Failed to initialize video call");
      setIsLoading(false);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (publisherRef.current) {
      publisherRef.current.publishVideo(!isVideoEnabled);
      setIsVideoEnabled((prev) => !prev);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (publisherRef.current) {
      publisherRef.current.publishAudio(!isAudioEnabled);
      setIsAudioEnabled((prev) => !prev);
    }
  };

  // End call
  const endCall = () => {
    // Properly destroy publisher
    if (publisherRef.current) {
      publisherRef.current.destroy();
    }
    setHasPublisher(false);

    // Disconnect session
    if (sessionRef.current) {
      sessionRef.current.disconnect();
    }
    setIsConnected(false);

    router.push("/appointments");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (publisherRef.current) {
        publisherRef.current.destroy();
      }
      if (sessionRef.current) {
        sessionRef.current.disconnect();
      }
    };
  }, []);

  if (!sessionId || !token || !appId) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">
          Invalid Video Call
        </h1>
        <p className="text-muted-foreground mb-6">
          Missing required parameters for the video call.
        </p>
        <Button
          onClick={() => router.push("/appointments")}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          Back to Appointments
        </Button>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://unpkg.com/@vonage/client-sdk-video@latest/dist/js/opentok.js"
        onLoad={handleScriptLoad}
        onError={() => {
          toast.error("Failed to load video call script");
          setIsLoading(false);
        }}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Video Consultation
          </h1>
          <p className="text-muted-foreground">
            {isConnected
              ? "Connected"
              : isLoading
              ? "Connecting..."
              : "Connection failed"}
          </p>
        </div>

        {isLoading && !scriptLoaded ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 text-emerald-400 animate-spin mb-4" />
            <p className="text-white text-lg">
              Loading video call components...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Publisher (Your video) */}
              <div className="border border-emerald-900/20 rounded-lg overflow-hidden">
                <div className="bg-emerald-900/10 px-3 py-2 text-emerald-400 text-sm font-medium">
                  You
                </div>
                <div
                  id="publisher"
                  className="w-full h-[300px] md:h-[400px] bg-muted/30"
                >
                  {!scriptLoaded && (
                    <div className="flex items-center justify-center h-full">
                      <div className="bg-muted/20 rounded-full p-8">
                        <User className="h-12 w-12 text-emerald-400" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Subscriber (Other person's video) */}
              <div className="border border-emerald-900/20 rounded-lg overflow-hidden">
                <div className="bg-emerald-900/10 px-3 py-2 text-emerald-400 text-sm font-medium">
                  Other Participant
                </div>
                <div
                  id="subscriber"
                  className="w-full h-[300px] md:h-[400px] bg-muted/30"
                >
                  {(!isConnected || !scriptLoaded) && (
                    <div className="flex items-center justify-center h-full">
                      <div className="bg-muted/20 rounded-full p-8">
                        <User className="h-12 w-12 text-emerald-400" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Video controls */}
            <div className="flex justify-center space-x-4">
              <Button
                variant="outline"
                size="lg"
                onClick={toggleVideo}
                className={`rounded-full p-4 h-14 w-14 ${
                  isVideoEnabled
                    ? "border-emerald-900/30"
                    : "bg-red-900/20 border-red-900/30 text-red-400"
                }`}
                disabled={!hasPublisher}
              >
                {isVideoEnabled ? <Video /> : <VideoOff />}
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={toggleAudio}
                className={`rounded-full p-4 h-14 w-14 ${
                  isAudioEnabled
                    ? "border-emerald-900/30"
                    : "bg-red-900/20 border-red-900/30 text-red-400"
                }`}
                disabled={!hasPublisher}
              >
                {isAudioEnabled ? <Mic /> : <MicOff />}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                onClick={endCall}
                className="rounded-full p-4 h-14 w-14 bg-red-600 hover:bg-red-700"
              >
                <PhoneOff />
              </Button>
            </div>

            <div className="text-center">
              <p className="text-muted-foreground text-sm">
                {isVideoEnabled ? "Camera on" : "Camera off"} •
                {isAudioEnabled ? " Microphone on" : " Microphone off"}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                When you are finished with your consultation, click the red
                button to end the call
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
