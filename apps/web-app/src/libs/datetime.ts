export const formatUtc = (utcTimeStr: string | undefined, locale: string = 'zh-CN') => {
  if (!utcTimeStr) {
    return ''
  }
  const utcDate = new Date(utcTimeStr + 'Z')
  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // 使用24小时制
    timeZoneName: 'short' // 包含时区信息
  })

  const formattedDateTime = formatter.format(utcDate)
  return `${formattedDateTime}`
}
