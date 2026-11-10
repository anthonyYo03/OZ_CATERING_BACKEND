export const secretKey =`${process.env.SECRET_KEY}`;

if (!secretKey) {

  console.error('❌ FATAL ERROR: SECRET_KEY not found in .env file');

  process.exit(1); // Stop the server immediately

}