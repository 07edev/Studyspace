import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export function StudyIllustration() {
  return (
    <Svg
      width="100%"
      height={220}
      viewBox="0 0 340 230"
      accessible
      accessibilityLabel="Minh họa sách, bản đồ và một góc học xanh"
    >
      <Ellipse cx="170" cy="126" rx="147" ry="99" fill="#E8F0E9" />
      <Circle cx="278" cy="45" r="19" fill="#D7EF9A" />
      <Circle cx="51" cy="174" r="9" fill="#D7EF9A" />
      <G rotation="-8" origin="170,120">
        <Rect
          x="62"
          y="46"
          width="210"
          height="143"
          rx="22"
          fill="#FFFFFF"
          stroke="#D9E3D8"
          strokeWidth="2"
        />
        <Path
          d="M131 47V188M201 47V188M63 104H270M63 147H270"
          stroke="#E8EEE5"
          strokeWidth="2"
        />
        <Path
          d="M82 164L112 133L152 144L178 107L219 112L246 77"
          fill="none"
          stroke="#A6C08E"
          strokeWidth="4"
          strokeDasharray="6 7"
          strokeLinecap="round"
        />
        <Circle cx="84" cy="163" r="7" fill="#285C49" />
        <Path
          d="M225 76C225 62 235 53 247 53C259 53 269 62 269 76C269 91 247 109 247 109S225 91 225 76Z"
          fill="#285C49"
        />
        <Circle cx="247" cy="75" r="8" fill="#D7EF9A" />
      </G>
      <G rotation="8" origin="175,160">
        <Rect x="105" y="125" width="129" height="80" rx="13" fill="#1D4437" />
        <Path
          d="M169 139C149 128 128 131 116 136V189C135 184 153 187 169 195C184 187 204 184 223 189V136C208 131 189 128 169 139Z"
          fill="#F6F8E8"
        />
        <Path
          d="M169 140V194M126 149L155 153M126 159L155 163M183 153L211 149M183 163L211 159"
          stroke="#B9C9AB"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </G>
      <Path
        d="M275 173C289 146 300 142 308 143C307 160 298 174 275 183M275 182C260 167 258 153 263 143C276 151 281 163 275 182"
        fill="#719471"
      />
      <Path d="M273 179V201" stroke="#285C49" strokeWidth="3" />
      <Path d="M259 192H288L284 213H263Z" fill="#D7EF9A" />
      <Path
        d="M42 64H54M48 58V70M291 111H301M296 106V116"
        stroke="#719471"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
