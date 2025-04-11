

THREE.SuperShader = {

	uniforms: {

		"tDiffuse": 	{ type: "t", value: null },
		
		//Vignette
		"vigOffset":   { type: "f", value: 1.0 },
		"vigDarkness": { type: "f", value: 1.0 },

		//BrightnessContrast
		"brightness": { type: "f", value: 0 },

		//HueSaturationShader
		"hue":        { type: "f", value: 0 },
		"hueAmount":  { type: "f", value: 0 }, //0-1
		"saturation": { type: "f", value: 0 },

		//Phong Reflection
		"lightDir":   { type: "v3", value: new THREE.Vector3(1.0, 1.0, 1.0) },
		"lightInt":   { type: "f", value: 1.0 },
		"Ka":         { type: "f", value: 0.5 },
		"Kd":         { type: "f", value: 0.3 },
		"Ks":         { type: "f", value: 0.4 },
		"shininess":  { type: "f", value: 10.0 },

		//Rim Light
		"rimStart":   { type: "f", value: 0.1 },
		"rimEnd":     { type: "f", value: 0.2 },
		"rimCoef":    { type: "f", value: 0.2 },
		"rimColor":   { type: "v3", value: new THREE.Vector3(0.4, 0.6, 0.7) },

	},

	vertexShader: [

		"varying vec2 vUv;",
		"varying vec3 vPosition;",
		"varying vec3 vNormal;",

		"void main() {",

			"vUv = uv;",
			"vPosition = position;",
			"vNormal = normal;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",
		
		"uniform float vigOffset;",
		"uniform float vigDarkness;",

		"uniform float brightness;",
		"uniform float contrast;",

		"uniform float hue;",
		"uniform float hueAmount;",
		"uniform float saturation;",

		//Phong Reflection uniforms
		"uniform vec3 lightDir;",
		"uniform float lightInt;",
		"uniform float Ka;",
		"uniform float Kd;",
		"uniform float Ks;",
		"uniform float shininess;",

		//Rim Light uniforms
		"uniform float rimStart;",
		"uniform float rimEnd;",
		"uniform float rimCoef;",
		"uniform vec3 rimColor;",

		"varying vec2 vUv;",
		"varying vec3 vPosition;",
		"varying vec3 vNormal;",

		"vec2 PhongDir(vec3 lightDir, float lightInt, float Ka, float Kd, float Ks, float shininess) {",
			"vec3 s = normalize(lightDir);",
			"vec3 v = normalize(-vPosition);",
			"vec3 n = normalize(vNormal);",
			"vec3 h = normalize(2.0*n*n*s - s);",
			"float diffuse = Ka + Kd * lightInt * max(0.0, dot(n, s));",
			"float spec = Ks * pow(max(0.0, dot(v,h)), shininess);",
			"return vec2(diffuse, spec);",
		"}",

		"vec3 rim(vec3 color, float start, float end, float coef) {",
			"vec3 normal = normalize(vNormal);",
			"vec3 eye = normalize(-vPosition);",
			"float rim = smoothstep(start, end, 1.0 - dot(normal, eye));",
			"return clamp(rim, 0.0, 1.0) * coef * color;",
		"}",

		"void main() {",

			//orig color
			"vec4 col = texture2D( tDiffuse, vUv );",

			//vignette
			"vec2 uv = ( vUv - vec2( 0.5 ) ) * vec2( vigOffset );",
			"col = vec4( mix( col.rgb, vec3( 1.0 - vigDarkness ), dot( uv, uv ) ), col.a );",

			//BrightnessContrast
			"col.rgb += brightness;",

			// hue
			"float angle = hue * 3.14159265;",
			"float s = sin(angle), c = cos(angle);",
			"vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;",
			"float len = length(col.rgb);",
			"vec3 shiftedCol = vec3(",
				"dot(col.rgb, weights.xyz),",
				"dot(col.rgb, weights.zxy),",
				"dot(col.rgb, weights.yzx)",
			");",


 			"col = vec4( mix( col.rgb, shiftedCol.rgb, hueAmount ), 1.0 );",

			// Apply Phong reflection
			"vec3 lightVec = lightDir - vPosition;",
			"vec2 ds = PhongDir(lightVec, lightInt, Ka, Kd, Ks, shininess);",
			"float phongBrightness = ds.x + ds.y;",
			"col.rgb *= phongBrightness;",

			//Apply Rim Light
			"vec3 rimLight = rim(rimColor, rimStart, rimEnd, rimCoef);",
			"col.rgb += rimLight;",

			"gl_FragColor = col;",

		"}"

	].join("\n")

};
