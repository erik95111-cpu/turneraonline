import { Composition, Folder, Still } from "remotion";
import { HelloWorld } from "./HelloWorld";
import { Logo } from "./HelloWorld/Logo";
import { Title } from "./HelloWorld/Title";
import { V1Encendido } from "./electroparque/V1Encendido";
import { V2Broadcast } from "./electroparque/V2Broadcast";
import { V3Energia } from "./electroparque/V3Energia";
import { CarUi, PcbTexture, ScreenSlide } from "./electroparque/r3d/Textures";
import { R1TvReal } from "./electroparque/r3d/R1TvReal";
import { LoopAmbiente } from "./electroparque/LoopAmbiente";
import { R2Studio } from "./electroparque/r3d/R2Studio";
import { LoopVitrina, SEG } from "./electroparque/r3d/LoopVitrina";
import { DURATION, FPS, HEIGHT, WIDTH } from "./electroparque/theme";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Electroparque">
        <Composition
          id="Electroparque-1-Encendido"
          component={V1Encendido}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Electroparque-2-Broadcast"
          component={V2Broadcast}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Electroparque-3-Energia"
          component={V3Energia}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      </Folder>
      <Folder name="Electroparque-Loops">
        <Composition id="Loop-Ambiente-TV" component={LoopAmbiente} durationInFrames={450} fps={FPS} width={1920} height={1080} />
        <Composition id="Loop-Ambiente-Historia" component={LoopAmbiente} durationInFrames={450} fps={FPS} width={1080} height={1920} />
        <Composition id="Loop-Vitrina3D-TV" component={LoopVitrina} durationInFrames={SEG * 4} fps={FPS} width={1920} height={1080} />
        <Composition id="Loop-Vitrina3D-Historia" component={LoopVitrina} durationInFrames={SEG * 4} fps={FPS} width={1080} height={1920} />
      </Folder>
      <Folder name="Electroparque-Realista">
        <Composition id="Realista-1-TV3D" component={R1TvReal} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="Realista-2-Estudio3D" component={R2Studio} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
      </Folder>
      <Folder name="Texturas-3D">
        <Still id="Tex-Screen" component={ScreenSlide} width={968} height={548} defaultProps={{ slide: -1 }} />
        <Still id="Tex-CarUi" component={CarUi} width={1200} height={500} />
        <Still id="Tex-Pcb" component={PcbTexture} width={2048} height={2048} />
      </Folder>
      <Folder name="Elements">
        <Composition
          id="Logo"
          component={Logo}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            logoColor1: "#91EAE4",
            logoColor2: "#86A8E7",
          }}
        />
        <Composition
          id="Title"
          component={Title}
          durationInFrames={115}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            titleText: "Welcome to Remotion",
            titleColor: "#000000",
          }}
        />
      </Folder>
      <Composition
        // You can take the "id" to render a video:
        // bunx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
        }}
      />

    </>
  );
};
