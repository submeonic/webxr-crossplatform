import * as THREE from 'three'

export function createIridescentRegionMaterial({
  baseColor = 0xfff7ae,
  rimColor = 0xffffff,
  baseAlpha = 0.07,
  rimAlpha = 0.42,
  fresnelPower = 2.2,
} = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,

    uniforms: {
      uBaseColor: { value: new THREE.Color(baseColor) },
      uRimColor: { value: new THREE.Color(rimColor) },
      uBaseAlpha: { value: baseAlpha },
      uRimAlpha: { value: rimAlpha },
      uFresnelPower: { value: fresnelPower },
    },

    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,

    fragmentShader: /* glsl */ `
      uniform vec3 uBaseColor;
      uniform vec3 uRimColor;
      uniform float uBaseAlpha;
      uniform float uRimAlpha;
      uniform float uFresnelPower;

      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec3 normalDirection = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float facing = abs(dot(normalDirection, viewDirection));
        float fresnel = pow(1.0 - facing, uFresnelPower);
        float sheen = 0.5 + 0.5 * sin(
          (normalDirection.x - normalDirection.y + normalDirection.z) * 5.5
        );
        float colorMix = clamp(fresnel * 0.82 + sheen * 0.18, 0.0, 1.0);
        vec3 color = mix(uBaseColor, uRimColor, colorMix);
        float alpha = clamp(uBaseAlpha + fresnel * uRimAlpha, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
}

