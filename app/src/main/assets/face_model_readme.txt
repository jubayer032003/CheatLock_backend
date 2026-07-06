Place a MobileFaceNet or FaceNet TensorFlow Lite model at:

mobile_face_net.tflite

Expected input:
- Float32
- Shape: 1 x 112 x 112 x 3
- RGB normalized to (value - 127.5) / 128

Expected output:
- Float32 face embedding
- Current app wrapper expects 192 dimensions.

When this model is present, CheatLock uses real face embeddings for enrollment
and verification. When it is missing, the app falls back to the existing ML Kit
face geometry descriptor so exam flow remains usable during development.
