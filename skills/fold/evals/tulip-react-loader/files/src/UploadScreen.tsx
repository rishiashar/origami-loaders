import { useState } from 'react';
import { uploadFile } from './api';

export function UploadScreen() {
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(false);
    setProgress(0);
    await uploadFile(file, (p) => setProgress(p)); // p goes from 0 to 1
    setDone(true);
  }

  return (
    <section>
      <h1>Upload your design</h1>
      <input type="file" onChange={onPick} />
      {progress !== null && !done && <p>Uploading… {Math.round(progress * 100)}%</p>}
      {done && <p>Uploaded.</p>}
    </section>
  );
}
