export const SEQUENCE_FPS = [4, 8, 12, 16, 24] as const;
export type SequenceFps = (typeof SEQUENCE_FPS)[number];
export const DEFAULT_SEQUENCE_FPS: SequenceFps = 8;

export const FRAME_SHEET_PNG = "Spritesheet.png";
export const FRAME_DATA_JSON = "FrameData.json";

export type FrameSize = {
  width: number;
  height: number;
};

export type FramePlacement = {
  index: number;
  x: number;
  y: number;
};

export type FrameStripLayout = {
  frameCount: number;
  width: number;
  height: number;
  sheetWidth: number;
  sheetHeight: number;
  placements: FramePlacement[];
};

export type FrameDataFile = {
  app: "SpriteForge";
  version: 1;
  kind: "frame-sequence";
  image: typeof FRAME_SHEET_PNG;
  frameCount: number;
  width: number;
  height: number;
  fps: number;
};

export function normalizeSequenceFps(value: number): SequenceFps {
  return (SEQUENCE_FPS as readonly number[]).includes(value) ? (value as SequenceFps) : DEFAULT_SEQUENCE_FPS;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items.slice();
  }
  const next = items.slice();
  const [item] = next.splice(from, 1);
  if (item === undefined) return items.slice();
  next.splice(to, 0, item);
  return next;
}

/**
 * One horizontal row. Every frame sits in a shared cell (max width × max height),
 * centered on X and aligned to the bottom so a ground line is shared.
 */
export function layoutFrameStrip(frames: readonly FrameSize[]): FrameStripLayout {
  if (frames.length === 0) {
    throw new Error("내보낼 프레임이 없습니다.");
  }
  for (const frame of frames) {
    if (!Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width <= 0 || frame.height <= 0) {
      throw new Error("프레임 크기는 양의 정수여야 합니다.");
    }
  }
  const width = frames.reduce((max, frame) => Math.max(max, frame.width), 0);
  const height = frames.reduce((max, frame) => Math.max(max, frame.height), 0);
  return {
    frameCount: frames.length,
    width,
    height,
    sheetWidth: width * frames.length,
    sheetHeight: height,
    placements: frames.map((frame, index) => ({
      index,
      x: index * width + Math.floor((width - frame.width) / 2),
      y: height - frame.height,
    })),
  };
}

export function buildFrameData(layout: FrameStripLayout, fps: number): FrameDataFile {
  const rate = normalizeSequenceFps(fps);
  return {
    app: "SpriteForge",
    version: 1,
    kind: "frame-sequence",
    image: FRAME_SHEET_PNG,
    frameCount: layout.frameCount,
    width: layout.width,
    height: layout.height,
    fps: rate,
  };
}

/**
 * Static editor template. Frame count, cell size, and FPS come from FrameData.json
 * via File.ReadAllText. Sprite names are `frame_00`… from the index, never a user file name.
 * Requires Unity 2021.2+.
 */
export function buildAnimationClipScript(): string {
  return `// SpriteForge — drop this file in an Editor folder (the zip already does).
// Select Spritesheet.png, then run Tools/SpriteForge/Build Animation Clip.
// FrameData.json beside the texture supplies frameCount, width, height, and fps.
// This file is a static template: it does not embed source file names.
// Requires Unity 2021.2+.
#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.U2D.Sprites;
using UnityEngine;

public static class AnimationClipBuilder
{
    private const string FrameDataName = "FrameData.json";
    private const string ClipPath = "Assets/Animations/SpriteForgeClip.anim";
    private const string ControllerPath = "Assets/Animations/SpriteForgeClip.controller";

    [MenuItem("Tools/SpriteForge/Build Animation Clip")]
    public static void Build()
    {
        var texture = Selection.activeObject as Texture2D;
        if (texture == null)
        {
            EditorUtility.DisplayDialog("SpriteForge", "Project 창에서 Spritesheet.png 를 선택한 뒤 다시 실행하세요.", "확인");
            return;
        }

        var texturePath = AssetDatabase.GetAssetPath(texture);
        var directory = Path.GetDirectoryName(texturePath) ?? string.Empty;
        var jsonPath = Path.Combine(directory, FrameDataName);
        if (!File.Exists(jsonPath))
        {
            EditorUtility.DisplayDialog("SpriteForge", "같은 폴더에 FrameData.json 이 없습니다.", "확인");
            return;
        }

        FrameDataFile data;
        try
        {
            data = JsonUtility.FromJson<FrameDataFile>(File.ReadAllText(jsonPath));
        }
        catch (Exception exception)
        {
            EditorUtility.DisplayDialog("SpriteForge", "FrameData.json 을 읽지 못했습니다.\\n" + exception.Message, "확인");
            return;
        }

        if (data == null || data.frameCount <= 0 || data.width <= 0 || data.height <= 0 || data.fps <= 0)
        {
            EditorUtility.DisplayDialog("SpriteForge", "FrameData.json 에 frameCount, width, height, fps 가 없습니다.", "확인");
            return;
        }

        var textureImporter = AssetImporter.GetAtPath(texturePath) as TextureImporter;
        if (textureImporter == null)
        {
            EditorUtility.DisplayDialog("SpriteForge", "TextureImporter 를 찾지 못했습니다.", "확인");
            return;
        }

        try
        {
            ConfigureImporter(textureImporter, data.height);
            textureImporter.SaveAndReimport();

            texture = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);
            if (texture == null)
            {
                throw new InvalidOperationException("슬라이스한 텍스처를 다시 열지 못했습니다.");
            }

            if (texture.width < data.frameCount * data.width || texture.height < data.height)
            {
                EditorUtility.DisplayDialog("SpriteForge", "PNG 크기가 FrameData.json 의 프레임 규격보다 작습니다.", "확인");
                return;
            }

            SliceStrip(textureImporter, texture, data);
            var sprites = LoadSprites(texturePath);
            var clip = CreateLoopingClip(data, sprites);
            EnsureAnimationsFolder();
            ReplaceAsset(clip, ClipPath);

            var controller = AnimatorController.CreateAnimatorControllerAtPath(ControllerPath);
            var stateMachine = controller.layers[0].stateMachine;
            var state = stateMachine.AddState("Loop");
            state.motion = clip;
            stateMachine.defaultState = state;
            EditorUtility.SetDirty(controller);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Selection.activeObject = clip;
            EditorGUIUtility.PingObject(clip);
            EditorUtility.DisplayDialog(
                "SpriteForge",
                "루프 애니메이션 클립을 만들었습니다.\\n" + ClipPath + "\\n프레임 " + data.frameCount + " · " + data.fps + " FPS",
                "확인");
        }
        catch (Exception exception)
        {
            Debug.LogException(exception);
            EditorUtility.DisplayDialog("SpriteForge", exception.Message, "확인");
        }
    }

    private static void ConfigureImporter(TextureImporter textureImporter, int pixelsPerUnit)
    {
        textureImporter.textureType = TextureImporterType.Sprite;
        textureImporter.spriteImportMode = SpriteImportMode.Multiple;
        textureImporter.alphaIsTransparency = true;
        textureImporter.npotScale = TextureImporterNPOTScale.None;
        textureImporter.mipmapEnabled = false;
        textureImporter.maxTextureSize = 8192;
        textureImporter.spritePixelsPerUnit = pixelsPerUnit;
        textureImporter.filterMode = FilterMode.Point;
        textureImporter.textureCompression = TextureImporterCompression.Uncompressed;
        textureImporter.crunchedCompression = false;

        var settings = new TextureImporterSettings();
        textureImporter.ReadTextureSettings(settings);
        settings.spriteMeshType = SpriteMeshType.FullRect;
        settings.spriteExtrude = 0;
        settings.filterMode = FilterMode.Point;
        settings.mipmapEnabled = false;
        settings.alphaIsTransparency = true;
        textureImporter.SetTextureSettings(settings);
    }

    private static void SliceStrip(TextureImporter textureImporter, Texture2D texture, FrameDataFile data)
    {
        var factories = new SpriteDataProviderFactories();
        factories.Init();
        var dataProvider = factories.GetSpriteEditorDataProviderFromObject(textureImporter);
        dataProvider.InitSpriteEditorDataProvider();

        var rects = new SpriteRect[data.frameCount];
        var pairs = new SpriteNameFileIdPair[data.frameCount];
        var unityY = texture.height - data.height;
        for (var i = 0; i < data.frameCount; i++)
        {
            var spriteId = GUID.Generate();
            var name = "frame_" + i.ToString("00");
            rects[i] = new SpriteRect
            {
                name = name,
                spriteID = spriteId,
                rect = new Rect(i * data.width, unityY, data.width, data.height),
                alignment = SpriteAlignment.BottomCenter,
                pivot = new Vector2(0.5f, 0f),
                border = Vector4.zero
            };
            pairs[i] = new SpriteNameFileIdPair(name, spriteId);
        }

        dataProvider.SetSpriteRects(rects);
        var nameFileIdProvider = dataProvider.GetDataProvider<ISpriteNameFileIdDataProvider>();
        if (nameFileIdProvider != null)
        {
            nameFileIdProvider.SetNameFileIdPairs(pairs);
        }

        dataProvider.Apply();
        textureImporter.SaveAndReimport();
    }

    private static Dictionary<string, Sprite> LoadSprites(string texturePath)
    {
        var lookup = new Dictionary<string, Sprite>();
        foreach (var asset in AssetDatabase.LoadAllAssetRepresentationsAtPath(texturePath))
        {
            var sprite = asset as Sprite;
            if (sprite != null) lookup[sprite.name] = sprite;
        }
        return lookup;
    }

    private static AnimationClip CreateLoopingClip(FrameDataFile data, Dictionary<string, Sprite> sprites)
    {
        var clip = new AnimationClip();
        clip.frameRate = data.fps;
        var binding = new EditorCurveBinding
        {
            type = typeof(SpriteRenderer),
            path = "",
            propertyName = "m_Sprite"
        };
        var keys = new ObjectReferenceKeyframe[data.frameCount];
        for (var i = 0; i < data.frameCount; i++)
        {
            keys[i] = new ObjectReferenceKeyframe
            {
                time = i / (float)data.fps,
                value = RequireSprite(sprites, i)
            };
        }

        AnimationUtility.SetObjectReferenceCurve(clip, binding, keys);
        var settings = AnimationUtility.GetAnimationClipSettings(clip);
        settings.loopTime = true;
        settings.loopBlend = false;
        settings.startTime = 0f;
        settings.stopTime = data.frameCount / (float)data.fps;
        AnimationUtility.SetAnimationClipSettings(clip, settings);
        return clip;
    }

    private static Sprite RequireSprite(Dictionary<string, Sprite> sprites, int index)
    {
        var name = "frame_" + index.ToString("00");
        Sprite sprite;
        if (!sprites.TryGetValue(name, out sprite) || sprite == null)
        {
            throw new InvalidOperationException("스프라이트 " + name + " 을 찾지 못했습니다.");
        }
        return sprite;
    }

    private static void EnsureAnimationsFolder()
    {
        if (!AssetDatabase.IsValidFolder("Assets/Animations"))
        {
            AssetDatabase.CreateFolder("Assets", "Animations");
        }
    }

    private static void ReplaceAsset(UnityEngine.Object asset, string path)
    {
        if (AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(path) != null)
        {
            AssetDatabase.DeleteAsset(path);
        }
        if (AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(ControllerPath) != null)
        {
            AssetDatabase.DeleteAsset(ControllerPath);
        }
        AssetDatabase.CreateAsset(asset, path);
    }
}

[System.Serializable]
public class FrameDataFile
{
    public int frameCount;
    public int width;
    public int height;
    public int fps;
}
#endif
`;
}
