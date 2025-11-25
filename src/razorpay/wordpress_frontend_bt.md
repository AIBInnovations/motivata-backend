```html
<style>
  /* ===========================
   MOTIVATA POPUP COMPONENT CSS
   =========================== */

  .motivata-buy-now-btn {
    padding: 0px 25px;
    background: #fff;
    color: #000;
    border: 2px solid #000;
    font-size: 18px;
    cursor: pointer;
    font-weight: 500;
    transition: 0.3s ease;
  }

  .motivata-buy-now-btn:hover {
    background: #000;
    color: #fff;
  }

  /* Overlay */
  .motivata-popup-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.45);
    justify-content: center;
    align-items: center;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.35s ease;
  }

  /* Overlay Visible Class */
  .motivata-show {
    display: flex !important;
    opacity: 1 !important;
  }

  /* Popup Box */
  .motivata-popup-box {
    background: #fff;
    padding: 25px;
    width: 350px;
    border-radius: 6px;
    border: 2px solid #000;
    position: relative;
    transform: translateY(-40px);
    opacity: 0;
    transition: all 0.35s ease;
  }

  /* Popup animated when active */
  .motivata-popup-active {
    transform: translateY(0px);
    opacity: 1;
  }

  .motivata-popup-box h2 {
    margin-bottom: 15px;
    color: #000;
    font-size: 22px;
    font-weight: 600;
  }

  /* Fields */
  .motivata-popup-box input {
    width: 100%;
    padding: 10px;
    margin-bottom: 12px;
    border: 1px solid #000;
    border-radius: 3px;
    font-size: 14px;
    color: black !important;
  }

  /* Submit Button */
  .motivata-submit-btn {
    width: 100%;
    background: #000;
    color: #fff;
    padding: 10px;
    border: none;
    cursor: pointer;
    transition: 0.3s ease;
  }

  .motivata-submit-btn:hover {
    background: #333;
  }

  /* Close Button */
  .motivata-close-btn {
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 22px;
    cursor: pointer;
    color: #000;
    font-weight: bold;
  }
</style>

<button id="motivataBuyBtn" class="motivata-buy-now-btn">BUY NOW</button>

<div class="motivata-popup-overlay" id="motivataPopupOverlay">
  <div class="motivata-popup-box" id="motivataPopupBox">
    <span class="motivata-close-btn" id="motivataClosePopup">×</span>

    <h2>Fill Your Details</h2>

    <form id="motivataPaymentForm">
      <input type="text" id="motivataName" placeholder="Name" required />
      <input type="email" id="motivataEmail" placeholder="Email ID" required />
      <input
        type="tel"
        id="motivataPhone"
        placeholder="Phone Number"
        required
      />
      <input
        type="text"
        id="motivataInterest"
        placeholder="Interest"
        required
      />

      <button type="submit" class="motivata-submit-btn">Submit</button>
    </form>
  </div>
</div>

<!-- Razorpay Checkout Script -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>

<script>
  /* ===========================
   MOTIVATA POPUP COMPONENT JS
   =========================== */

  const btn = document.getElementById("motivataBuyBtn");
  const overlay = document.getElementById("motivataPopupOverlay");
  const popupBox = document.getElementById("motivataPopupBox");
  const closeBtn = document.getElementById("motivataClosePopup");
  const form = document.getElementById("motivataPaymentForm");

  // OPEN POPUP
  btn.addEventListener("click", function () {
    overlay.classList.add("motivata-show");
    setTimeout(() => popupBox.classList.add("motivata-popup-active"), 50);
  });

  // CLOSE POPUP
  function motivataClose() {
    popupBox.classList.remove("motivata-popup-active");
    setTimeout(() => overlay.classList.remove("motivata-show"), 300);
  }

  closeBtn.addEventListener("click", motivataClose);

  // Close when clicking outside
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) motivataClose();
  });

  // SUBMIT FORM → CALL VERCEL API → OPEN RAZORPAY CHECKOUT
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("motivataName").value;
    const email = document.getElementById("motivataEmail").value;
    const phone = document.getElementById("motivataPhone").value;
    const interest = document.getElementById("motivataInterest").value;

    // Your Vercel Serverless Function Endpoint
    const apiURL =
      "https://serverless-function-weld.vercel.app/api/create-order";

    const response = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        interest,
        amount: 499,
      }),
    });

    const data = await response.json();

    if (!data?.orderId) {
      alert("Error creating order. Try again.");
      return;
    }

    const options = {
      key: "rzp_live_RfiSt8Qm9shvHH",
      order_id: data.orderId,
      amount: 499 * 100,
      currency: "INR",
      name: "Motivata",
      description: "Ticket Payment",
      prefill: {
        name,
        email,
        contact: phone,
      },
      notes: { interest },
      theme: { color: "#000000" },
      handler: function () {
        window.location.href = "/payment-success"; // optional success page
      },
    };

    new Razorpay(options).open();
  });
</script>
```
