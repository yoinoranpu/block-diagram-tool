export async function calculate<T>(kind: string, data: object): Promise<T> {
  const worker = new Worker(new URL("./math.worker.ts", import.meta.url), {
    type: "module",
  });
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(
        new Error(
          "計算を15秒で中止しました。初版の計算上限です。式や線図を簡単にしてください。",
        ),
      );
    }, 15000);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.value);
    };
    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      reject(
        new Error(
          "計算エンジンを起動できませんでした。ページを再読み込みしてください。",
        ),
      );
    };
    worker.postMessage({ ...data, id: 1, kind });
  });
}
