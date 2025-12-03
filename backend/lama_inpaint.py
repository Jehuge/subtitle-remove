import os
from typing import Union, Optional

import numpy as np
import torch
from PIL import Image

from . import config


def _get_image_array(img: Union[Image.Image, np.ndarray]) -> np.ndarray:
    """ get_image：统一为 CHW，float32/255."""
    if isinstance(img, Image.Image):
        arr = np.array(img)
    elif isinstance(img, np.ndarray):
        arr = img.copy()
    else:
        raise ValueError("image/mask must be PIL.Image or np.ndarray")

    if arr.ndim == 3:
        arr = np.transpose(arr, (2, 0, 1))  # HWC -> CHW
    elif arr.ndim == 2:
        arr = arr[np.newaxis, ...]

    arr = arr.astype(np.float32) / 255.0
    return arr


def _ceil_modulo(x: int, mod: int) -> int:
    if x % mod == 0:
        return x
    return (x // mod + 1) * mod


def _pad_to_modulo(img: np.ndarray, mod: int) -> np.ndarray:
    c, h, w = img.shape
    out_h = _ceil_modulo(h, mod)
    out_w = _ceil_modulo(w, mod)
    return np.pad(
        img,
        ((0, 0), (0, out_h - h), (0, out_w - w)),
        mode="symmetric",
    )


def _prepare_img_and_mask(
    image: Union[Image.Image, np.ndarray],
    mask: Union[Image.Image, np.ndarray],
    device: torch.device,
    pad_out_to_modulo: int = 8,
):
    """
    严格对齐 video-subtitle-remover/backend/inpaint/utils/lama_util.prepare_img_and_mask，
    确保 image 和 mask 在 LaMa 模型内部的尺寸完全匹配，避免 size mismatch。
    """
    if isinstance(image, Image.Image):
        orig_h, orig_w = image.size[1], image.size[0]
    else:
        orig_h, orig_w = image.shape[0], image.shape[1]

    out_image = _get_image_array(image)
    out_mask = _get_image_array(mask)

    if pad_out_to_modulo is not None and pad_out_to_modulo > 1:
        out_image = _pad_to_modulo(out_image, pad_out_to_modulo)
        out_mask = _pad_to_modulo(out_mask, pad_out_to_modulo)

    image_tensor = torch.from_numpy(out_image).unsqueeze(0).to(device)
    mask_tensor = torch.from_numpy(out_mask).unsqueeze(0).to(device)
    mask_tensor = (mask_tensor > 0) * 1

    return image_tensor, mask_tensor, (orig_h, orig_w)


class LamaInpaint:
    """
    轻量封装：加载 LaMa(big-lama) 模型，对单张图片进行 inpaint。
    """

    def __init__(self,
                 device: Optional[torch.device] = None,
                 model_path: Optional[os.PathLike] = None) -> None:
        if device is None:
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if model_path is None:
            # 与 video-subtitle-remover 中保持一致的命名
            model_path = config.LAMA_MODEL_PATH / "big-lama.pt"

        self.device = device
        self.model = torch.jit.load(str(model_path), map_location=device)
        self.model.eval()
        self.model.to(device)

    def __call__(self,
                 image: Union[Image.Image, np.ndarray],
                 mask: Union[Image.Image, np.ndarray]) -> np.ndarray:
        image_tensor, mask_tensor, (orig_h, orig_w) = _prepare_img_and_mask(
            image, mask, self.device
        )
        with torch.inference_mode():
            inpainted = self.model(image_tensor, mask_tensor)
            cur_res = inpainted[0].permute(1, 2, 0).detach().cpu().numpy()
            cur_res = np.clip(cur_res * 255, 0, 255).astype("uint8")
            cur_res = cur_res[:orig_h, :orig_w]
            return cur_res


