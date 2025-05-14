const handleContact = (phoneNumber: string) => {
  // Format phone number for WhatsApp (remove any non-digit characters)
  const formattedNumber = phoneNumber.replace(/\D/g, '');
  // Open WhatsApp chat in new tab
  window.open(`https://wa.me/${formattedNumber}`, '_blank');
};

// In the card JSX, update the contact button:
<Button
  variant="outline"
  size="sm"
  onClick={() => handleContact(post.user.phoneNumber)}
  className="flex items-center gap-2"
>
  <MessageCircle className="h-4 w-4" />
  Contact via WhatsApp
</Button> 