import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";
import { pool } from "./db";

let transporter: Transporter;
let account: { user: string; pass: string };

export const getDefaultSender = () => account.user;

export async function initMailer() {
  if (config.etherealUser && config.etherealPass) {
    account = { user: config.etherealUser, pass: config.etherealPass };
  } else {
    const saved = await pool.query(`SELECT value FROM settings WHERE key='ethereal'`);
    if (saved.rows[0]) {
      account = saved.rows[0].value;
    } else {
      const t = await nodemailer.createTestAccount();
      account = { user: t.user, pass: t.pass };
      await pool.query(`INSERT INTO settings (key, value) VALUES ('ethereal', $1)`, [account]);
      console.log(`[mailer] created Ethereal account ${t.user}`);
    }
  }
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: account,
  });
  console.log(`[mailer] using Ethereal account ${account.user}`);
}

export async function sendMail(opts: { from: string; to: string; subject: string; text: string }) {
  const info = await transporter.sendMail(opts);
  return {
    messageId: info.messageId as string,
    previewUrl: (nodemailer.getTestMessageUrl(info) as string | false) || null,
  };
}
