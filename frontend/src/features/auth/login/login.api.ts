import { loginWithPassword, saveAuthSession } from "../../../services/auth"

import type { LoginCredentials } from "./login.contract"

export async function submitLogin(credentials: LoginCredentials) {
  const session = await loginWithPassword(credentials.email, credentials.password)
  saveAuthSession(session)
  return session
}
