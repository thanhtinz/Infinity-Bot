import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { encrypt, decrypt, maskKey } from '../src/lib/crypto';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Connecting to Postgres via Prisma + @prisma/adapter-pg...');

  const passwordHash = await bcrypt.hash('correct horse battery staple', 10);
  const user = await prisma.user.create({
    data: { email: `test-${Date.now()}@example.com`, passwordHash, name: 'Test User' },
  });
  console.log('Created user:', user.id);

  const passwordOk = await bcrypt.compare('correct horse battery staple', user.passwordHash);
  const passwordBad = await bcrypt.compare('wrong password', user.passwordHash);
  console.log('bcrypt correct password matches:', passwordOk);
  console.log('bcrypt wrong password correctly rejected:', !passwordBad);

  const secretKey = 'AIzaSyFAKE-TEST-KEY-1234567890';
  const enc = encrypt(secretKey);
  const dec = decrypt(enc);
  console.log('Encryption round-trip matches:', dec === secretKey);
  console.log('Encrypted value differs from plaintext:', enc !== secretKey);
  console.log('Masked key:', maskKey(secretKey));

  const aiConfig = await prisma.userAIConfig.create({
    data: { userId: user.id, provider: 'gemini', encryptedKey: enc, isActive: true },
  });
  const fetched = await prisma.userAIConfig.findUnique({ where: { id: aiConfig.id } });
  console.log('Stored key is encrypted at rest (not plaintext):', fetched!.encryptedKey !== secretKey);
  console.log('Decrypting the stored value round-trips correctly:', decrypt(fetched!.encryptedKey) === secretKey);

  const convo = await prisma.chatConversation.create({ data: { userId: user.id, title: 'First chat' } });
  await prisma.chatMessage.create({ data: { conversationId: convo.id, role: 'user', content: 'Hello!' } });
  await prisma.chatMessage.create({ data: { conversationId: convo.id, role: 'assistant', content: 'Hi there!' } });
  const messages = await prisma.chatMessage.findMany({ where: { conversationId: convo.id }, orderBy: { createdAt: 'asc' } });
  console.log('Chat messages persisted in order:', messages.map((m) => m.role).join(',') === 'user,assistant');

  const project = await prisma.codeProject.create({
    data: { userId: user.id, name: 'hello-world', language: 'python', code: 'print("hi")' },
  });
  const execution = await prisma.codeExecution.create({
    data: { projectId: project.id, language: 'python', stdout: 'hi\n', stderr: '', exitCode: 0, durationMs: 42 },
  });
  console.log('Code project + execution linked correctly:', execution.projectId === project.id);

  // Cleanup
  await prisma.codeExecution.deleteMany({ where: { projectId: project.id } });
  await prisma.codeProject.deleteMany({ where: { userId: user.id } });
  await prisma.chatMessage.deleteMany({ where: { conversationId: convo.id } });
  await prisma.chatConversation.deleteMany({ where: { userId: user.id } });
  await prisma.userAIConfig.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('Cleanup complete.');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
