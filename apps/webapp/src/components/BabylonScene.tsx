import React, { useEffect, useRef, useState } from 'react';
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { AxesViewer } from "@babylonjs/core/Debug/axesViewer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";

import MainScene from "../playground/main-scene";
import LogoutButton from "./LogoutButton";
import DemoModal from "./DemoModal";

interface BabylonSceneProps {
  className?: string;
}

const BabylonScene: React.FC<BabylonSceneProps> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | WebGPUEngine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [showModal, setShowModal] = useState(false);
  // Load demo timeout from environment variable (defaults to 2 minutes)
  const DEMO_TIMEOUT_MS = parseInt(import.meta.env.VITE_DEMO_TIMEOUT_MS || '120000', 10);

  // Show modal after configured timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowModal(true);
    }, DEMO_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: Engine | WebGPUEngine;
    let scene: Scene;

    const initWebGPU = async () => {
      const webgpu = new WebGPUEngine(canvas, {
        adaptToDeviceRatio: true,
        antialias: true,
      });
      await webgpu.initAsync();
      engine = webgpu;
      console.log(engine);

      scene = new Scene(engine);
      
      // Add physics
      await setPhysics(scene);

      new MainScene(scene, canvas, engine);

      config(scene, engine);
      renderer(engine, scene);
    };

    const setPhysics = async (scene: Scene): Promise<void> => {
      const gravity = new Vector3(0, -9.81, 0);
      const hk = await HavokPhysics();
      const plugin = new HavokPlugin(true, hk);
      scene.enablePhysics(gravity, plugin);
    };

    const fps = (engine: Engine | WebGPUEngine): void => {
      const dom = document.getElementById("display-fps");
      if (dom) {
        dom.innerHTML = `${engine.getFps().toFixed()} fps`;
      } else {
        const div = document.createElement("div");
        div.id = "display-fps";
        div.innerHTML = "0";
        document.body.appendChild(div);
      }
    };

    const bindEvent = async (scene: Scene, engine: Engine | WebGPUEngine): Promise<void> => {
      // Imports and hide/show the Inspector
      // Works only in DEV mode to reduce the size of the PRODUCTION build
      // Comment IF statement to work in both modes
      if (import.meta.env.DEV) {
        await Promise.all([import("@babylonjs/core/Debug/debugLayer"), import("@babylonjs/inspector")]);

        window.addEventListener("keydown", (ev) => {
          // Shift+Ctrl+Alt+I
          if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
            if (scene.debugLayer.isVisible()) {
              scene.debugLayer.hide();
            } else {
              scene.debugLayer.show();
            }
          }
        });
      } // End of IF statement

      // resize window
      window.addEventListener("resize", () => {
        engine.resize();
      });

      window.onbeforeunload = () => {
        // I have tested it myself and the system will automatically remove this junk.
        scene.onBeforeRenderObservable.clear();
        scene.onAfterRenderObservable.clear();
        scene.onKeyboardObservable.clear();
      };
    };

    const config = (scene: Scene, engine: Engine | WebGPUEngine): void => {
      // Axes
      // new AxesViewer();

      // Inspector and other stuff
      bindEvent(scene, engine);
    };

    const renderer = (engine: Engine | WebGPUEngine, scene: Scene): void => {
      engine.runRenderLoop(() => {
        fps(engine);
        scene.render();
      });
    };

    // Initialize the scene
    initWebGPU().then(() => {
      // Store references for cleanup after initialization
      engineRef.current = engine;
      sceneRef.current = scene;
    });

    // Cleanup function
    return () => {
      if (sceneRef.current) {
        sceneRef.current.onBeforeRenderObservable.clear();
        sceneRef.current.onAfterRenderObservable.clear();
        sceneRef.current.onKeyboardObservable.clear();
      }
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          outline: 'none'
        }}
      />
      <LogoutButton />
      <DemoModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
};

export default BabylonScene; 