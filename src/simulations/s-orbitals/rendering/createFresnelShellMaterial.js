import * as THREE from 'three'

export function createFresnelShellMaterial({
  color = 0x7ee7ff,
  baseAlpha = 0.1,
  fresnelAlpha = 0.28,
  fresnelPower = 0.28,
} = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,

    uniforms: {
      uColor: {
        value: new THREE.Color(color),
      },

      uBaseAlpha: {
        value: baseAlpha,
      },

      uFresnelAlpha: {
        value: fresnelAlpha,
      },

      uFresnelPower: {
        value: fresnelPower,
      },
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
      uniform vec3 uColor;
      uniform float uBaseAlpha;
      uniform float uFresnelAlpha;
      uniform float uFresnelPower;

      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec3 normalDirection = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

        float facing = abs(dot(normalDirection, viewDirection));
        float fresnel = pow(1.0 - facing, uFresnelPower);

        float alpha = clamp(
          uBaseAlpha + fresnel * uFresnelAlpha,
          0.0,
          1.0
        );

        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  })
}