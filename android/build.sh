#!/usr/bin/env bash
# Builds android/build/mycelium-forest.apk from the web game (no Gradle needed).
# Needs (Ubuntu): apt-get install android-sdk-platform-23 aapt apksigner zipalign dalvik-exchange
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk
JAR=$SDK/platforms/android-23/android.jar
B=build
rm -rf "$B" && mkdir -p "$B/gen" "$B/obj" "$B/assets/src" "$B/assets/art" "$B/res"
cp -r res/. "$B/res/"
# the game: page, code and only the sprites it loads
cp ../index.html "$B/assets/"
cp ../src/*.js "$B/assets/src/"
cp -r ../art/sprites "$B/assets/art/"
# launcher icon from the ripe mushroom sprite
python3 - "$B/res" <<'PY'
import sys, os
from PIL import Image
im = Image.open('../art/sprites/mushroom_6.png').convert('RGBA')
for name, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    c = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    t = im.copy(); t.thumbnail((px, px), Image.LANCZOS)
    c.alpha_composite(t, ((px - t.width) // 2, (px - t.height) // 2))
    d = os.path.join(sys.argv[1], 'mipmap-' + name); os.makedirs(d, exist_ok=True)
    c.save(os.path.join(d, 'ic_launcher.png'))
PY
aapt package -f -m -M AndroidManifest.xml -S "$B/res" -I "$JAR" -J "$B/gen" -A "$B/assets" -F "$B/unsigned.apk" -0 png -0 jpg
javac -nowarn --release 8 -classpath "$JAR" -d "$B/obj" $(find src "$B/gen" -name '*.java') 2>&1 | grep -v "warning" || true
dalvik-exchange --dex --output="$B/classes.dex" "$B/obj"
(cd "$B" && aapt add unsigned.apk classes.dex >/dev/null)
zipalign -f 4 "$B/unsigned.apk" "$B/aligned.apk"
KS=${KEYSTORE:-mycelium.keystore}
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass mycelium -keypass mycelium -alias mycelium \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mycelium Forest" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass pass:mycelium --key-pass pass:mycelium --ks-key-alias mycelium \
  --out "$B/mycelium-forest.apk" "$B/aligned.apk"
apksigner verify --print-certs "$B/mycelium-forest.apk" | head -2
ls -la "$B/mycelium-forest.apk"
