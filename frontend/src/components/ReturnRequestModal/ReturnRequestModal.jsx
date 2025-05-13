import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import './ReturnRequestModal.css';

const ReturnRequestModal = ({ isOpen, onClose, orderId, orderItem, items }) => {
  const { submitReturnRequest } = useContext(AuthContext);
  const [reason, setReason] = useState('');
  const [requestType, setRequestType] = useState('Return');
  const [comments, setComments] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(orderItem?.order_item_id || orderItem?.id || '');

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        toast.error('Only JPEG, PNG, or GIF images are allowed');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Please provide a reason for the return');
      return;
    }
    if (!selectedItemId && items?.length) {
      toast.error('Please select an item to return');
      return;
    }

    const selectedItem = items?.find(
      (item) => (item.order_item_id || item.id) === selectedItemId
    ) || orderItem;

    if (!selectedItem) {
      toast.error('Invalid item selected');
      return;
    }

    const returnData = {
      order_id: orderId,
      order_item_id: selectedItem.order_item_id || selectedItem.id,
      reason,
      request_type: requestType,
      comments: comments || undefined,
    };

    const result = await submitReturnRequest(returnData, image);
    if (result.success) {
      toast.success(`${requestType} request for ${selectedItem.name} submitted successfully!`, {
        position: 'top-right',
        autoClose: 3000,
      });
      onClose();
      setReason('');
      setRequestType('Return');
      setComments('');
      setImage(null);
      setImagePreview(null);
      setSelectedItemId('');
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="modal-content bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">Request Return/Refund</h3>
        <form onSubmit={handleSubmit}>
          <p className="mb-2"><strong>Order ID:</strong> {orderId}</p>
          {items?.length > 1 && (
            <label className="block mb-2">
              Select Item:
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
              >
                <option value="">Select an item</option>
                {items.map((item) => (
                  <option key={item.order_item_id || item.id} value={item.order_item_id || item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(!items || items.length <= 1) && orderItem && (
            <p className="mb-4"><strong>Product:</strong> {orderItem.name}</p>
          )}

          <label className="block mb-2">
            Request Type:
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="w-full mt-1 p-2 border rounded"
            >
              <option value="Return">Return</option>
              <option value="Refund">Refund</option>
            </select>
          </label>

          <label className="block mb-2">
            Reason for Return/Refund:
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Please provide the reason for your request"
              className="w-full mt-1 p-2 border rounded"
            />
          </label>

          <label className="block mb-2">
            Additional Comments:
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Any additional details"
              className="w-full mt-1 p-2 border rounded"
            />
          </label>

          <label className="block mb-4">
            Upload Image (Optional, max 5MB, JPEG/PNG/GIF):
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif"
              onChange={handleImageChange}
              className="w-full mt-1"
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-2 w-full h-32 object-cover rounded"
              />
            )}
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnRequestModal;