# Art Direction Interview — Question Bank

Run conversationally. Start with references — the user will often answer the palette and mood questions implicitly through the references they share.

---

## Section 1: References and Mood

1. **Share three to five images or games that represent the target visual style.** (URLs, Artstation links, game titles + specific scenes — be specific)
2. **What is the single most important feeling the visuals must produce on first sight?** ("Dread", "wonder", "aggression", "oppressive scale", "intimacy" — a named emotion)
3. **Describe the world in three words.** (Already gathered in concept interview — confirm it matches the visual references or update)
4. **Is the setting more:
   - Natural / organic (rock, soil, vegetation, weathering)
   - Industrial / built (concrete, metal, glass, pipes)
   - Hybrid (ruins, overgrown tech, organic architecture)
   Ask the user to describe, not choose from this list.**

---

## Section 2: Palette

5. **What is the dominant color family?** (Desaturated earth, neon highlight on dark, warm sunset, cold blue-white, etc.)
6. **Is there a signature accent color?** (The color that appears on enemies, on loot, on HUD elements — the color the player's eye learns to track)
7. **What colors are explicitly forbidden?** (Some studios ban pure black, ban saturated reds in the environment to reserve them for blood, etc.)

From the answers, propose a four-to-six color palette as hex codes with role labels (Background, Mid, Highlight, Accent, Danger, Neutral). Confirm before continuing.

---

## Section 3: Character and Enemy Visual Language

8. **How do player characters and enemies read from 30 meters?** (Silhouette shape, color contrast against environment, scale)
9. **How do enemies communicate threat level visually?** (Size, color variance, material surface — glowing weak points, armor plating, etc.)
10. **What is the art style for characters?** (Hyper-realistic, stylized-realistic, painterly, cel-shaded, something else)

---

## Section 4: Environment Visual Language

11. **What is the lighting signature of the world?** (Overcast diffuse, harsh directional, neon rim, moody interior, dynamic day-night)
12. **What surfaces dominate?** (Megascans filter guidance: stone/rock/concrete/wood/metal/organic — pick the top two)
13. **How detailed is the world at close range?** (Film-quality surface detail vs. stylized flat reads — this affects material complexity budget)
14. **Are there any environments that must feel distinctly different from the default?** (Safe zones, alien areas, flashback sequences)

---

## Section 5: UI and HUD Style

15. **What is the HUD philosophy?** (Diegetic / screen-space / minimal / maximalist)
16. **What UI aesthetic matches the world?** (Military HUD, sci-fi holographic, hand-drawn, clean corporate, grimy analog)
17. **What color does the HUD use for health, ammo, and objectives?** (These should be the palette's accent and danger colors — confirm they are distinct)

---

## Section 6: Technical Constraints

18. **Performance target: GTX 1060 / PS5-equivalent at 60 FPS.** (Nanite and Lumen are off by default. Confirm the user understands this — ask if they want the premium look now with a softer perf target, or strict 60 FPS with baked lighting.)
19. **Is this a dark/interior game, an exterior/open game, or both?** (Interior: baked lightmaps are cheap and look great. Exterior: sky atmosphere + directional light + DDGI or baked — pick.)
20. **Is there a day-night cycle or weather system in the vertical slice?** (Yes adds significant lighting complexity — scope flag.)
