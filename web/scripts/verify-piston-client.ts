import 'dotenv/config';
import { listRuntimes, executeCode } from '../src/lib/piston';

async function main() {
  const runtimes = await listRuntimes();
  console.log('Runtimes fetched:', runtimes.map((r) => r.language).join(', '));

  const py = await executeCode({ language: 'python', code: 'print(1 + 2)\nprint("hello from python")' });
  console.log('Python stdout:', JSON.stringify(py.run.stdout));
  console.log('Python exit code correct:', py.run.code === 0);

  const js = await executeCode({ language: 'javascript', code: 'console.log(2 ** 10); console.log("hello from js")' });
  console.log('JS stdout:', JSON.stringify(js.run.stdout));
  console.log('JS exit code correct:', js.run.code === 0);

  const cpp = await executeCode({
    language: 'c++',
    code: '#include <iostream>\nint main() { std::cout << "hello from c++" << std::endl; return 0; }',
  });
  console.log('C++ stdout:', JSON.stringify(cpp.run.stdout));
  console.log('C++ exit code correct:', cpp.run.code === 0);

  const withStdin = await executeCode({ language: 'python', code: 'name = input()\nprint(f"hi {name}")', stdin: 'World\n' });
  console.log('Python with stdin:', JSON.stringify(withStdin.run.stdout));
  console.log('stdin handling correct:', withStdin.run.stdout.trim() === 'hi World');

  const broken = await executeCode({ language: 'python', code: 'print(undefined_variable)' });
  console.log('Broken code correctly reports non-zero exit:', broken.run.code !== 0);
  console.log('Broken code stderr non-empty:', broken.run.stderr.length > 0);

  const compileError = await executeCode({ language: 'c++', code: 'int main() { this is not valid c++ ; }' });
  console.log('Compile error surfaced via compile.stderr:', !!compileError.compile?.stderr);
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
