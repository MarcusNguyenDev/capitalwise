/** "+61491570156" -> "+61 491 570 156" */
export function formatMobileNumber(mobile_phone: string): string {
  const australian_mobile = /^\+61(\d{3})(\d{3})(\d{3})$/.exec(mobile_phone);
  return australian_mobile ? `+61 ${australian_mobile[1]} ${australian_mobile[2]} ${australian_mobile[3]}` : mobile_phone;
}
