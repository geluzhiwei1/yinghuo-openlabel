export const validateEmail = (email: string): boolean => {
  const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  return emailReg.test(email)
}

export const validateMobilePhoneNo = (phoneNo: string): boolean => {
  const r = /^1[3-9]\d{9}$/
  return r.test(phoneNo)
}
